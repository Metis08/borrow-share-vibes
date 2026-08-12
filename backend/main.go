package main

import (
	"database/sql"
	"encoding/json"
	"log"
	"net/http"
	"strings"

	_ "github.com/mattn/go-sqlite3"
	"golang.org/x/crypto/bcrypt"
)

var db *sql.DB

type User struct {
	ID           int    `json:"id"`
	Username     string `json:"username"`
	PasswordHash string `json:"-"`
	Phone        string `json:"phone"`
	Area         string `json:"area"`
	ShelfName    string `json:"shelfName"`
}

type RegistrationDetails struct {
	Username string `json:"username"`
	Password string `json:"password"`
}

type RegisterRequest struct {
	Username string `json:"username"`
	Password string `json:"password"`
}

type LoginRequest struct {
	Username string `json:"username"`
	Password string `json:"password"`
}

type SetupProfileRequest struct {
	Username  string `json:"username"`
	Phone     string `json:"phone"`
	Area      string `json:"area"`
	ShelfName string `json:"shelfName"`
}

type BorrowRequest struct {
	ItemID   string `json:"itemId"`
	ItemName string `json:"itemName"`
	Lender   string `json:"lender"`
	DaysLeft int    `json:"daysLeft"`
	Since    string `json:"since"`
	Note     string `json:"note"`
}

type LendRequest struct {
	ItemName string `json:"itemName"`
}

type BorrowedItem struct {
	ID       int    `json:"id"`
	Username string `json:"username"`
	ItemID   string `json:"itemId"`
	ItemName string `json:"itemName"`
	Lender   string `json:"lender"`
	DaysLeft int    `json:"daysLeft"`
	Since    string `json:"since"`
	Note     string `json:"note"`
}

type LentItem struct {
	ID       int    `json:"id"`
	Username string `json:"username"`
	ItemName string `json:"itemName"`
	Status   string `json:"status"`
}

func initDB() {
	var err error
	db, err = sql.Open("sqlite3", "./mohalla.db")
	if err != nil {
		log.Fatalf("Error opening database: %v", err)
	}

	// Create tables
	queries := []string{
		`CREATE TABLE IF NOT EXISTS users (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			username TEXT UNIQUE NOT NULL,
			password_hash TEXT NOT NULL,
			phone TEXT DEFAULT '',
			area TEXT DEFAULT '',
			shelf_name TEXT DEFAULT ''
		);`,
		`CREATE TABLE IF NOT EXISTS borrowed_items (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			username TEXT NOT NULL,
			item_id TEXT NOT NULL,
			item_name TEXT NOT NULL,
			lender TEXT NOT NULL,
			days_left INTEGER NOT NULL,
			since TEXT NOT NULL,
			note TEXT NOT NULL
		);`,
		`CREATE TABLE IF NOT EXISTS lent_items (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			username TEXT NOT NULL,
			item_name TEXT NOT NULL,
			status TEXT NOT NULL
		);`,
	}

	for _, q := range queries {
		_, err = db.Exec(q)
		if err != nil {
			log.Fatalf("Error creating table: %v", err)
		}
	}

	// Dynamic column setup for old tables
	db.Exec("ALTER TABLE users ADD COLUMN phone TEXT DEFAULT ''")
	db.Exec("ALTER TABLE users ADD COLUMN area TEXT DEFAULT ''")
	db.Exec("ALTER TABLE users ADD COLUMN shelf_name TEXT DEFAULT ''")
}

func enableCORS(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
		if r.Method == "OPTIONS" {
			w.WriteHeader(http.StatusOK)
			return
		}
		next(w, r)
	}
}

func registerHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req RegisterRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Bad request", http.StatusBadRequest)
		return
	}

	req.Username = strings.TrimSpace(req.Username)
	if req.Username == "" || len(req.Password) < 3 {
		http.Error(w, "Invalid credentials. Password must be >= 3 characters.", http.StatusBadRequest)
		return
	}

	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	_, err = db.Exec("INSERT INTO users (username, password_hash) VALUES (?, ?)", req.Username, string(hashedPassword))
	if err != nil {
		if strings.Contains(err.Error(), "UNIQUE constraint failed") {
			http.Error(w, "Username already exists", http.StatusConflict)
			return
		}
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(map[string]string{"message": "Registration successful"})
}

func loginHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req LoginRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Bad request", http.StatusBadRequest)
		return
	}

	var user User
	err := db.QueryRow("SELECT id, username, password_hash FROM users WHERE username = ?", req.Username).Scan(&user.ID, &user.Username, &user.PasswordHash)
	if err != nil {
		http.Error(w, "Invalid username or password", http.StatusUnauthorized)
		return
	}

	err = bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(req.Password))
	if err != nil {
		http.Error(w, "Invalid username or password", http.StatusUnauthorized)
		return
	}

	// In a full application we would issue a JWT. Today we return a simple session token (the username itself)
	json.NewEncoder(w).Encode(map[string]string{
		"token":    user.Username,
		"username": user.Username,
	})
}

func getUsernameFromAuth(r *http.Request) string {
	authHeader := r.Header.Get("Authorization")
	if authHeader == "" {
		return ""
	}
	parts := strings.Split(authHeader, " ")
	if len(parts) == 2 && parts[0] == "Bearer" {
		return parts[1]
	}
	return ""
}

func profileHandler(w http.ResponseWriter, r *http.Request) {
	username := getUsernameFromAuth(r)
	if username == "" {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	// Fetch user details
	var phone, area, shelfName string
	err := db.QueryRow("SELECT phone, area, shelf_name FROM users WHERE username = ?", username).Scan(&phone, &area, &shelfName)
	if err != nil {
		phone = ""
		area = ""
		shelfName = ""
	}

	// Fetch borrowed items
	rows, err := db.Query("SELECT id, item_id, item_name, lender, days_left, since, note FROM borrowed_items WHERE username = ?", username)
	if err != nil {
		http.Error(w, "Database error", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	borrowed := []BorrowedItem{}
	for rows.Next() {
		var item BorrowedItem
		item.Username = username
		if err := rows.Scan(&item.ID, &item.ItemID, &item.ItemName, &item.Lender, &item.DaysLeft, &item.Since, &item.Note); err == nil {
			borrowed = append(borrowed, item)
		}
	}

	// Fetch lent items
	rowsLent, err := db.Query("SELECT id, item_name, status FROM lent_items WHERE username = ?", username)
	if err != nil {
		http.Error(w, "Database error", http.StatusInternalServerError)
		return
	}
	defer rowsLent.Close()

	lent := []LentItem{}
	for rowsLent.Next() {
		var item LentItem
		item.Username = username
		if err := rowsLent.Scan(&item.ID, &item.ItemName, &item.Status); err == nil {
			lent = append(lent, item)
		}
	}

	json.NewEncoder(w).Encode(map[string]interface{}{
		"username":  username,
		"phone":     phone,
		"area":      area,
		"shelfName": shelfName,
		"borrowed":  borrowed,
		"lent":      lent,
	})
}

func borrowHandler(w http.ResponseWriter, r *http.Request) {
	username := getUsernameFromAuth(r)
	if username == "" {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req BorrowRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Bad request", http.StatusBadRequest)
		return
	}

	_, err := db.Exec(
		"INSERT INTO borrowed_items (username, item_id, item_name, lender, days_left, since, note) VALUES (?, ?, ?, ?, ?, ?, ?)",
		username, req.ItemID, req.ItemName, req.Lender, req.DaysLeft, req.Since, req.Note,
	)
	if err != nil {
		http.Error(w, "Database error", http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(map[string]string{"message": "Item borrowed successfully"})
}

func lendHandler(w http.ResponseWriter, r *http.Request) {
	username := getUsernameFromAuth(r)
	if username == "" {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req LendRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Bad request", http.StatusBadRequest)
		return
	}

	_, err := db.Exec(
		"INSERT INTO lent_items (username, item_name, status) VALUES (?, ?, ?)",
		username, req.ItemName, "active",
	)
	if err != nil {
		http.Error(w, "Database error", http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(map[string]string{"message": "Item put up for lending successfully"})
}

func setupProfileHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req SetupProfileRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Bad request", http.StatusBadRequest)
		return
	}

	req.Username = strings.TrimSpace(req.Username)
	req.Phone = strings.TrimSpace(req.Phone)
	req.Area = strings.TrimSpace(req.Area)
	req.ShelfName = strings.TrimSpace(req.ShelfName)

	if req.Username == "" || req.Phone == "" || req.Area == "" || req.ShelfName == "" {
		http.Error(w, "All profile details (phone, area, shelf title) are required.", http.StatusBadRequest)
		return
	}

	_, err := db.Exec("UPDATE users SET phone = ?, area = ?, shelf_name = ? WHERE username = ?", req.Phone, req.Area, req.ShelfName, req.Username)
	if err != nil {
		http.Error(w, "Database error: "+err.Error(), http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]string{"message": "Profile setup completed successfully"})
}

func main() {
	initDB()
	defer db.Close()

	http.HandleFunc("/api/register", enableCORS(registerHandler))
	http.HandleFunc("/api/login", enableCORS(loginHandler))
	http.HandleFunc("/api/profile", enableCORS(profileHandler))
	http.HandleFunc("/api/borrow", enableCORS(borrowHandler))
	http.HandleFunc("/api/lend", enableCORS(lendHandler))
	http.HandleFunc("/api/setup_profile", enableCORS(setupProfileHandler))

	log.Println("Backend server running on http://localhost:8085")
	log.Fatal(http.ListenAndServe(":8085", nil))
}

package main

import (
	"database/sql"
	"encoding/json"
	"log"
	"net/http"
	"strings"
	"math"
	"strconv"

	_ "github.com/mattn/go-sqlite3"
	"golang.org/x/crypto/bcrypt"
)

var db *sql.DB

type User struct {
	ID                     int     `json:"id"`
	Username               string  `json:"username"`
	PasswordHash           string  `json:"-"`
	Phone                  string  `json:"phone"`
	Area                   string  `json:"area"`
	ShelfName              string  `json:"shelfName"`
	LocationSharingEnabled bool    `json:"locationSharingEnabled"`
	Latitude               float64 `json:"latitude"`
	Longitude              float64 `json:"longitude"`
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
	ItemName    string `json:"itemName"`
	Category    string `json:"category"`
	Description string `json:"description"`
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
	ID          int    `json:"id"`
	Username    string `json:"username"`
	ItemName    string `json:"itemName"`
	Status      string `json:"status"`
	Category    string `json:"category"`
	Description string `json:"description"`
	CreatedAt   string `json:"createdAt"`
}

type UpdateLocationRequest struct {
	LocationSharingEnabled bool    `json:"locationSharingEnabled"`
	Latitude               float64 `json:"latitude"`
	Longitude              float64 `json:"longitude"`
}

type RadarItem struct {
	ID          int     `json:"id"`
	ItemName    string  `json:"itemName"`
	Category    string  `json:"category"`
	Description string  `json:"description"`
	Status      string  `json:"status"`
	CreatedAt   string  `json:"createdAt"`
	Owner       string  `json:"owner"`
	ShelfName   string  `json:"shelfName"`
	Phone       string  `json:"phone"`
	Latitude    float64 `json:"latitude"`
	Longitude   float64 `json:"longitude"`
	DistanceKM  float64 `json:"distanceKm"`
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
			shelf_name TEXT DEFAULT '',
			location_sharing_enabled INTEGER DEFAULT 0,
			latitude REAL DEFAULT 0.0,
			longitude REAL DEFAULT 0.0
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
			status TEXT NOT NULL,
			category TEXT DEFAULT 'Other',
			description TEXT DEFAULT '',
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP
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
	db.Exec("ALTER TABLE users ADD COLUMN location_sharing_enabled INTEGER DEFAULT 0")
	db.Exec("ALTER TABLE users ADD COLUMN latitude REAL DEFAULT 0.0")
	db.Exec("ALTER TABLE users ADD COLUMN longitude REAL DEFAULT 0.0")

	db.Exec("ALTER TABLE lent_items ADD COLUMN category TEXT DEFAULT 'Other'")
	db.Exec("ALTER TABLE lent_items ADD COLUMN description TEXT DEFAULT ''")
	db.Exec("ALTER TABLE lent_items ADD COLUMN created_at DATETIME DEFAULT '2026-08-13 12:00:00'")
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
	var locationSharingEnabledVal int
	var latitude, longitude float64
	err := db.QueryRow("SELECT phone, area, shelf_name, location_sharing_enabled, latitude, longitude FROM users WHERE username = ?", username).Scan(&phone, &area, &shelfName, &locationSharingEnabledVal, &latitude, &longitude)
	if err != nil {
		phone = ""
		area = ""
		shelfName = ""
		locationSharingEnabledVal = 0
		latitude = 0.0
		longitude = 0.0
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
	if err := rows.Err(); err != nil {
		http.Error(w, "Database error during row iteration", http.StatusInternalServerError)
		return
	}

	// Fetch lent items
	rowsLent, err := db.Query("SELECT id, item_name, status, category, description, created_at FROM lent_items WHERE username = ?", username)
	if err != nil {
		http.Error(w, "Database error", http.StatusInternalServerError)
		return
	}
	defer rowsLent.Close()

	lent := []LentItem{}
	for rowsLent.Next() {
		var item LentItem
		item.Username = username
		if err := rowsLent.Scan(&item.ID, &item.ItemName, &item.Status, &item.Category, &item.Description, &item.CreatedAt); err == nil {
			lent = append(lent, item)
		}
	}
	if err := rowsLent.Err(); err != nil {
		http.Error(w, "Database error during lent row iteration", http.StatusInternalServerError)
		return
	}

	json.NewEncoder(w).Encode(map[string]interface{}{
		"username":               username,
		"phone":                  phone,
		"area":                   area,
		"shelfName":              shelfName,
		"locationSharingEnabled": locationSharingEnabledVal == 1,
		"latitude":               latitude,
		"longitude":              longitude,
		"borrowed":               borrowed,
		"lent":                   lent,
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

	if req.Category == "" {
		req.Category = "Other"
	}

	_, err := db.Exec(
		"INSERT INTO lent_items (username, item_name, status, category, description, created_at) VALUES (?, ?, ?, ?, ?, datetime('now'))",
		username, req.ItemName, "active", req.Category, req.Description,
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

func updateLocationHandler(w http.ResponseWriter, r *http.Request) {
	username := getUsernameFromAuth(r)
	if username == "" {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req UpdateLocationRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Bad request", http.StatusBadRequest)
		return
	}

	optIn := 0
	if req.LocationSharingEnabled {
		optIn = 1
	}

	_, err := db.Exec("UPDATE users SET location_sharing_enabled = ?, latitude = ?, longitude = ? WHERE username = ?", optIn, req.Latitude, req.Longitude, username)
	if err != nil {
		http.Error(w, "Database error: "+err.Error(), http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]string{"message": "Location updated successfully"})
}

func haversine(lat1, lon1, lat2, lon2 float64) float64 {
	const R = 6371 // Earth radius in km
	dLat := (lat2 - lat1) * (math.Pi / 180.0)
	dLon := (lon2 - lon1) * (math.Pi / 180.0)
	rLat1 := lat1 * (math.Pi / 180.0)
	rLat2 := lat2 * (math.Pi / 180.0)

	a := math.Sin(dLat/2)*math.Sin(dLat/2) +
		math.Sin(dLon/2)*math.Sin(dLon/2)*math.Cos(rLat1)*math.Cos(rLat2)
	c := 2 * math.Atan2(math.Sqrt(a), math.Sqrt(1-a))
	return R * c
}

func deterministicFuzz(val float64, username string) float64 {
	var sum int
	for _, char := range username {
		sum += int(char)
	}
	// Shift by a constant small offset (up to ~0.001 degrees, approx 110m)
	offset := (float64(sum%200) - 100) / 100000.0
	return val + offset
}

func radarItemsHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	qParams := r.URL.Query()
	latStr := qParams.Get("lat")
	lngStr := qParams.Get("lng")
	radiusStr := qParams.Get("radius")
	categoryFilter := qParams.Get("category")
	searchQ := qParams.Get("q")
	sortVal := qParams.Get("sort")

	var lat, lng float64
	var err error
	if latStr != "" {
		lat, err = strconv.ParseFloat(latStr, 64)
		if err != nil {
			http.Error(w, "Invalid lat parameter", http.StatusBadRequest)
			return
		}
	} else {
		lat = 28.6448 // Default center
	}

	if lngStr != "" {
		lng, err = strconv.ParseFloat(lngStr, 64)
		if err != nil {
			http.Error(w, "Invalid lng parameter", http.StatusBadRequest)
			return
		}
	} else {
		lng = 77.2167 // Default center
	}

	radius := 5.0
	if radiusStr != "" {
		rVal, err := strconv.ParseFloat(radiusStr, 64)
		if err == nil {
			radius = rVal
		}
	}

	// Query all active items owned by users table who opted in
	rows, err := db.Query(`
		SELECT 
			l.id, l.username, l.item_name, l.status, l.category, l.description, l.created_at,
			u.shelf_name, u.phone, u.latitude, u.longitude
		FROM lent_items l
		JOIN users u ON l.username = u.username
		WHERE l.status = 'active'
		  AND u.location_sharing_enabled = 1
	`)
	if err != nil {
		http.Error(w, "Database error", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var list []RadarItem
	for rows.Next() {
		var item RadarItem
		var ownerLat, ownerLng float64
		err = rows.Scan(
			&item.ID, &item.Owner, &item.ItemName, &item.Status, &item.Category, &item.Description, &item.CreatedAt,
			&item.ShelfName, &item.Phone, &ownerLat, &ownerLng,
		)
		if err != nil {
			continue
		}

		dist := haversine(lat, lng, ownerLat, ownerLng)
		if dist > radius {
			continue
		}

		if categoryFilter != "" && categoryFilter != "All" && !strings.EqualFold(item.Category, categoryFilter) {
			continue
		}

		if searchQ != "" {
			nameLower := strings.ToLower(item.ItemName)
			descLower := strings.ToLower(item.Description)
			qLower := strings.ToLower(searchQ)
			if !strings.Contains(nameLower, qLower) && !strings.Contains(descLower, qLower) {
				continue
			}
		}

		item.DistanceKM = dist
		item.Latitude = deterministicFuzz(ownerLat, item.Owner)
		item.Longitude = deterministicFuzz(ownerLng, item.Owner)
		list = append(list, item)
	}
	if err := rows.Err(); err != nil {
		http.Error(w, "Database error during radar items iteration", http.StatusInternalServerError)
		return
	}

	// Sort list
	if strings.EqualFold(sortVal, "recent") {
		for i := 0; i < len(list); i++ {
			for j := i + 1; j < len(list); j++ {
				if list[i].ID < list[j].ID {
					list[i], list[j] = list[j], list[i]
				}
			}
		}
	} else {
		for i := 0; i < len(list); i++ {
			for j := i + 1; j < len(list); j++ {
				if list[i].DistanceKM > list[j].DistanceKM {
					list[i], list[j] = list[j], list[i]
				}
			}
		}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(list)
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
	http.HandleFunc("/api/user/location", enableCORS(updateLocationHandler))
	http.HandleFunc("/api/radar/items", enableCORS(radarItemsHandler))

	log.Println("Backend server running on http://localhost:8085")
	log.Fatal(http.ListenAndServe(":8085", nil))
}

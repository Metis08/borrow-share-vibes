package main

import (
	"context"
	"database/sql"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"log"
	"math"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/gorilla/websocket"
	_ "github.com/mattn/go-sqlite3"
	"golang.org/x/crypto/bcrypt"
)

var db *sql.DB

func getJWTSecret() []byte {
	secret := os.Getenv("JWT_SECRET")
	if secret == "" {
		secret = "mohalla_dev_secret_key_change_in_production_2026"
	}
	return []byte(secret)
}

type Claims struct {
	UserID   int    `json:"user_id"`
	Username string `json:"username"`
	jwt.RegisteredClaims
}

type contextKey string

const userContextKey contextKey = "user"

type UserContext struct {
	UserID   int
	Username string
}

type User struct {
	ID                     int     `json:"id"`
	Username               string  `json:"username"`
	Email                  string  `json:"email"`
	FullName               string  `json:"fullName"`
	PasswordHash           string  `json:"-"`
	Phone                  string  `json:"phone"`
	Area                   string  `json:"area"`
	ShelfName              string  `json:"shelfName"`
	Bio                    string  `json:"bio"`
	ProfileImage           string  `json:"profileImage"`
	LocationSharingEnabled bool    `json:"locationSharingEnabled"`
	Latitude               float64 `json:"latitude"`
	Longitude              float64 `json:"longitude"`
	CreatedAt              string  `json:"createdAt"`
	UpdatedAt              string  `json:"updatedAt"`
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
	FullName     string `json:"fullName"`
	Email        string `json:"email"`
	Phone        string `json:"phone"`
	Area         string `json:"area"`
	ShelfName    string `json:"shelfName"`
	Bio          string `json:"bio"`
	ProfileImage string `json:"profileImage"`
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
	LenderName  string `json:"lenderName"`
	Area        string `json:"area"`
	Phone       string `json:"phone"`
	Duration    string `json:"duration"`
	Condition   string `json:"condition"`
	ImageUrl    string `json:"imageUrl"`
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
	ItemNameAlt string `json:"item_name,omitempty"`
	Status      string `json:"status"`
	Category    string `json:"category"`
	Description string `json:"description"`
	LenderName  string `json:"lenderName"`
	Area        string `json:"area"`
	Phone       string `json:"phone"`
	Duration    string `json:"duration"`
	Condition   string `json:"condition"`
	ImageUrl    string `json:"imageUrl"`
	CreatedAt   string `json:"createdAt"`
}

func persistItemImage(dataURL string) (string, error) {
	dataURL = strings.TrimSpace(dataURL)
	if dataURL == "" {
		return "", nil
	}
	if strings.HasPrefix(dataURL, "/uploads/") || strings.HasPrefix(dataURL, "http://") || strings.HasPrefix(dataURL, "https://") {
		return dataURL, nil
	}
	if !strings.HasPrefix(dataURL, "data:") {
		return dataURL, nil
	}

	comma := strings.Index(dataURL, ",")
	if comma < 0 {
		return "", fmt.Errorf("invalid image data")
	}

	meta := strings.ToLower(dataURL[:comma])
	payload := dataURL[comma+1:]
	raw, err := base64.StdEncoding.DecodeString(payload)
	if err != nil {
		raw, err = base64.RawStdEncoding.DecodeString(payload)
		if err != nil {
			return "", fmt.Errorf("could not decode image")
		}
	}
	if len(raw) == 0 {
		return "", nil
	}

	ext := ".jpg"
	switch {
	case strings.Contains(meta, "image/png"):
		ext = ".png"
	case strings.Contains(meta, "image/webp"):
		ext = ".webp"
	case strings.Contains(meta, "image/gif"):
		ext = ".gif"
	}

	if err := os.MkdirAll("uploads", 0755); err != nil {
		return "", err
	}
	name := fmt.Sprintf("item-%d%s", time.Now().UnixNano(), ext)
	path := filepath.Join("uploads", name)
	if err := os.WriteFile(path, raw, 0644); err != nil {
		return "", err
	}
	return "/uploads/" + name, nil
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

type BorrowRequestRecord struct {
	ID               int    `json:"id"`
	ItemID           string `json:"itemId"`
	ItemName         string `json:"itemName"`
	BorrowerUsername string `json:"borrowerUsername"`
	LenderUsername   string `json:"lenderUsername"`
	Status           string `json:"status"` // "pending", "accepted", "rejected"
	Note             string `json:"note"`
	CreatedAt        string `json:"createdAt"`
	UpdatedAt        string `json:"updatedAt"`
	ConversationID   *int   `json:"conversationId,omitempty"`
}

type CreateBorrowRequestInput struct {
	ItemID   string `json:"itemId"`
	ItemName string `json:"itemName"`
	Lender   string `json:"lender"`
	Note     string `json:"note"`
}

type AcceptRejectInput struct {
	RequestID int `json:"requestId"`
}

type ConversationRecord struct {
	ID               int    `json:"id"`
	BorrowRequestID  int    `json:"borrowRequestId"`
	BorrowerUsername string `json:"borrowerUsername"`
	LenderUsername   string `json:"lenderUsername"`
	ItemID           string `json:"itemId"`
	ItemName         string `json:"itemName"`
	OtherUser        string `json:"otherUser"`
	LastMessage      string `json:"lastMessage"`
	LastMessageTime  string `json:"lastMessageTime"`
	UnreadCount      int    `json:"unreadCount"`
	CreatedAt        string `json:"createdAt"`
	UpdatedAt        string `json:"updatedAt"`
}

type MessageRecord struct {
	ID             int     `json:"id"`
	ConversationID int     `json:"conversationId"`
	SenderUsername string  `json:"senderUsername"`
	Content        string  `json:"content"`
	CreatedAt      string  `json:"createdAt"`
	ReadAt         *string `json:"readAt,omitempty"`
}

type SendMessageInput struct {
	ConversationID int    `json:"conversationId"`
	Content        string `json:"content"`
}

type RecommendationPost struct {
	ID              int                        `json:"id"`
	UserID          int                        `json:"userId"`
	Username        string                     `json:"username"`
	Title           string                     `json:"title"`
	Description     string                     `json:"description"`
	Category        string                     `json:"category"`
	Area            string                     `json:"area"`
	CreatedAt       string                     `json:"createdAt"`
	UpdatedAt       string                     `json:"updatedAt"`
	RepliesCount    int                        `json:"repliesCount"`
	NeighbourCount  int                        `json:"neighbourCount"`
	Replies         []RecommendationReply      `json:"replies,omitempty"`
	Recommendations []StructuredRecommendation `json:"recommendations,omitempty"`
}

type StructuredRecommendation struct {
	ID               int    `json:"id"`
	PostID           int    `json:"postId"`
	ReplyID          int    `json:"replyId"`
	Name             string `json:"name"`
	Category         string `json:"category"`
	Description      string `json:"description"`
	Location         string `json:"location"`
	CreatedBy        string `json:"createdBy"`
	RecommendedCount int    `json:"recommendedCount"`
	HasEndorsed      bool   `json:"hasEndorsed"`
	CreatedAt        string `json:"createdAt"`
}

type RecommendationReply struct {
	ID              int                       `json:"id"`
	PostID          int                       `json:"postId"`
	Username        string                    `json:"username"`
	Content         string                    `json:"content"`
	CreatedAt       string                    `json:"createdAt"`
	HelpfulCount    int                       `json:"helpfulCount"`
	HasVotedHelpful bool                      `json:"hasVotedHelpful"`
	Recommendation  *StructuredRecommendation `json:"recommendation,omitempty"`
}

type CreateRecommendationPostInput struct {
	Title       string `json:"title"`
	Description string `json:"description"`
	Category    string `json:"category"`
	Area        string `json:"area"`
}

type CreateRecommendationReplyInput struct {
	PostID         int    `json:"postId"`
	Content        string `json:"content"`
	RecName        string `json:"recName"`
	RecCategory    string `json:"recCategory"`
	RecDescription string `json:"recDescription"`
	RecLocation    string `json:"recLocation"`
}

type ToggleHelpfulInput struct {
	ReplyID int `json:"replyId"`
}

type EndorseRecommendationInput struct {
	RecommendationID int `json:"recommendationId"`
}

type MohallaMoment struct {
	ID               int      `json:"id"`
	BorrowRequestID  int      `json:"borrowRequestId"`
	BorrowerUsername string   `json:"borrowerUsername"`
	LenderUsername   string   `json:"lenderUsername"`
	ItemName         string   `json:"itemName"`
	ItemCategory     string   `json:"itemCategory"`
	UsageHeadline    string   `json:"usageHeadline"`
	UsageDescription string   `json:"usageDescription"`
	ThankYouMessage  string   `json:"thankYouMessage"`
	Photos           []string `json:"photos"`
	Area             string   `json:"area"`
	CreatedAt        string   `json:"createdAt"`
}

type CreateMohallaMomentInput struct {
	BorrowRequestID  int      `json:"borrowRequestId"`
	LenderUsername   string   `json:"lenderUsername"`
	ItemName         string   `json:"itemName"`
	ItemCategory     string   `json:"itemCategory"`
	UsageHeadline    string   `json:"usageHeadline"`
	UsageDescription string   `json:"usageDescription"`
	ThankYouMessage  string   `json:"thankYouMessage"`
	Photos           []string `json:"photos"`
	Area             string   `json:"area"`
}

type MohallaMomentsResponse struct {
	Moments            []MohallaMoment `json:"moments"`
	TotalBorrowedCount int             `json:"totalBorrowedCount"`
}



var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool {
		return true // Allow cross-origin WebSocket connections in dev
	},
}

type Client struct {
	conn           *websocket.Conn
	conversationID int
	username       string
}

type BroadcastMessage struct {
	ConversationID int
	Message        MessageRecord
}

type Hub struct {
	clients    map[*Client]bool
	broadcast  chan BroadcastMessage
	register   chan *Client
	unregister chan *Client
}

var hub = Hub{
	clients:    make(map[*Client]bool),
	broadcast:  make(chan BroadcastMessage),
	register:   make(chan *Client),
	unregister: make(chan *Client),
}

func (h *Hub) run() {
	for {
		select {
		case client := <-h.register:
			h.clients[client] = true
		case client := <-h.unregister:
			if _, ok := h.clients[client]; ok {
				delete(h.clients, client)
				client.conn.Close()
			}
		case bm := <-h.broadcast:
			for client := range h.clients {
				if client.conversationID == bm.ConversationID {
					err := client.conn.WriteJSON(bm.Message)
					if err != nil {
						client.conn.Close()
						delete(h.clients, client)
					}
				}
			}
		}
	}
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
			email TEXT DEFAULT '',
			full_name TEXT DEFAULT '',
			phone TEXT DEFAULT '',
			area TEXT DEFAULT '',
			shelf_name TEXT DEFAULT '',
			bio TEXT DEFAULT '',
			profile_image TEXT DEFAULT '',
			location_sharing_enabled INTEGER DEFAULT 0,
			latitude REAL DEFAULT 0.0,
			longitude REAL DEFAULT 0.0,
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
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
			lender_name TEXT DEFAULT '',
			area TEXT DEFAULT '',
			phone TEXT DEFAULT '',
			duration TEXT DEFAULT '7 Days',
			condition TEXT DEFAULT 'Good Working 👍',
			image_url TEXT DEFAULT '',
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP
		);`,
		`CREATE TABLE IF NOT EXISTS borrow_requests (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			item_id TEXT NOT NULL,
			item_name TEXT NOT NULL,
			borrower_username TEXT NOT NULL,
			lender_username TEXT NOT NULL,
			status TEXT NOT NULL DEFAULT 'pending',
			note TEXT DEFAULT '',
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
		);`,
		`CREATE TABLE IF NOT EXISTS conversations (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			borrow_request_id INTEGER UNIQUE NOT NULL,
			borrower_username TEXT NOT NULL,
			lender_username TEXT NOT NULL,
			item_id TEXT NOT NULL,
			item_name TEXT NOT NULL,
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			FOREIGN KEY(borrow_request_id) REFERENCES borrow_requests(id)
		);`,
		`CREATE TABLE IF NOT EXISTS messages (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			conversation_id INTEGER NOT NULL,
			sender_username TEXT NOT NULL,
			content TEXT NOT NULL,
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			read_at DATETIME NULL,
			FOREIGN KEY(conversation_id) REFERENCES conversations(id)
		);`,
		`CREATE TABLE IF NOT EXISTS recommendation_posts (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			user_id INTEGER NOT NULL,
			username TEXT NOT NULL,
			title TEXT NOT NULL,
			description TEXT DEFAULT '',
			category TEXT DEFAULT 'General',
			area TEXT DEFAULT 'Your mohalla',
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
		);`,
		`CREATE TABLE IF NOT EXISTS recommendation_replies (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			post_id INTEGER NOT NULL,
			username TEXT NOT NULL,
			content TEXT NOT NULL,
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			FOREIGN KEY(post_id) REFERENCES recommendation_posts(id) ON DELETE CASCADE
		);`,
		`CREATE TABLE IF NOT EXISTS recommendations (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			post_id INTEGER NOT NULL,
			reply_id INTEGER NOT NULL,
			name TEXT NOT NULL,
			category TEXT DEFAULT '',
			description TEXT DEFAULT '',
			location TEXT DEFAULT '',
			created_by TEXT NOT NULL,
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			FOREIGN KEY(post_id) REFERENCES recommendation_posts(id) ON DELETE CASCADE,
			FOREIGN KEY(reply_id) REFERENCES recommendation_replies(id) ON DELETE CASCADE
		);`,
		`CREATE TABLE IF NOT EXISTS recommendation_helpful_votes (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			reply_id INTEGER NOT NULL,
			username TEXT NOT NULL,
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			UNIQUE(reply_id, username)
		);`,
		`CREATE TABLE IF NOT EXISTS recommendation_endorsements (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			recommendation_id INTEGER NOT NULL,
			username TEXT NOT NULL,
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			UNIQUE(recommendation_id, username)
		);`,
		`CREATE TABLE IF NOT EXISTS mohalla_moments (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			borrow_request_id INTEGER DEFAULT 0,
			borrower_username TEXT NOT NULL,
			lender_username TEXT NOT NULL,
			item_name TEXT NOT NULL,
			item_category TEXT DEFAULT 'Borrowed Item',
			usage_headline TEXT NOT NULL,
			usage_description TEXT NOT NULL,
			thank_you_message TEXT DEFAULT '',
			photos TEXT DEFAULT '[]',
			area TEXT DEFAULT '',
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
	db.Exec("ALTER TABLE users ADD COLUMN email TEXT DEFAULT ''")
	db.Exec("ALTER TABLE users ADD COLUMN full_name TEXT DEFAULT ''")
	db.Exec("ALTER TABLE users ADD COLUMN phone TEXT DEFAULT ''")
	db.Exec("ALTER TABLE users ADD COLUMN area TEXT DEFAULT ''")
	db.Exec("ALTER TABLE users ADD COLUMN shelf_name TEXT DEFAULT ''")
	db.Exec("ALTER TABLE users ADD COLUMN bio TEXT DEFAULT ''")
	db.Exec("ALTER TABLE users ADD COLUMN profile_image TEXT DEFAULT ''")
	db.Exec("ALTER TABLE users ADD COLUMN location_sharing_enabled INTEGER DEFAULT 0")
	db.Exec("ALTER TABLE users ADD COLUMN latitude REAL DEFAULT 0.0")
	db.Exec("ALTER TABLE users ADD COLUMN longitude REAL DEFAULT 0.0")
	db.Exec("ALTER TABLE users ADD COLUMN created_at DATETIME DEFAULT CURRENT_TIMESTAMP")
	db.Exec("ALTER TABLE users ADD COLUMN updated_at DATETIME DEFAULT CURRENT_TIMESTAMP")

	db.Exec("ALTER TABLE lent_items ADD COLUMN category TEXT DEFAULT 'Other'")
	db.Exec("ALTER TABLE lent_items ADD COLUMN description TEXT DEFAULT ''")
	db.Exec("ALTER TABLE lent_items ADD COLUMN lender_name TEXT DEFAULT ''")
	db.Exec("ALTER TABLE lent_items ADD COLUMN area TEXT DEFAULT ''")
	db.Exec("ALTER TABLE lent_items ADD COLUMN phone TEXT DEFAULT ''")
	db.Exec("ALTER TABLE lent_items ADD COLUMN duration TEXT DEFAULT '7 Days'")
	db.Exec("ALTER TABLE lent_items ADD COLUMN condition TEXT DEFAULT 'Good Working 👍'")
	db.Exec("ALTER TABLE lent_items ADD COLUMN image_url TEXT DEFAULT ''")
	db.Exec("ALTER TABLE lent_items ADD COLUMN created_at DATETIME DEFAULT '2026-08-13 12:00:00'")

	seedRecommendationData()
}


func generateToken(userID int, username string) (string, error) {
	expirationTime := time.Now().Add(24 * time.Hour)
	claims := &Claims{
		UserID:   userID,
		Username: username,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(expirationTime),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
			Subject:   strconv.Itoa(userID),
		},
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString(getJWTSecret())
}

func JWTMiddleware(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		authHeader := r.Header.Get("Authorization")
		if authHeader == "" {
			http.Error(w, "Unauthorized: Missing Authorization header", http.StatusUnauthorized)
			return
		}

		parts := strings.Split(authHeader, " ")
		if len(parts) != 2 || parts[0] != "Bearer" {
			http.Error(w, "Unauthorized: Invalid Authorization header format", http.StatusUnauthorized)
			return
		}

		tokenStr := parts[1]
		claims := &Claims{}

		token, err := jwt.ParseWithClaims(tokenStr, claims, func(token *jwt.Token) (interface{}, error) {
			if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
				return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
			}
			return getJWTSecret(), nil
		})

		if err != nil || !token.Valid {
			http.Error(w, "Unauthorized: Invalid or expired token", http.StatusUnauthorized)
			return
		}

		ctx := context.WithValue(r.Context(), userContextKey, &UserContext{
			UserID:   claims.UserID,
			Username: claims.Username,
		})
		next(w, r.WithContext(ctx))
	}
}

func OptionalJWTMiddleware(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		authHeader := r.Header.Get("Authorization")
		if authHeader != "" {
			parts := strings.Split(authHeader, " ")
			if len(parts) == 2 && parts[0] == "Bearer" {
				tokenStr := parts[1]
				claims := &Claims{}
				token, err := jwt.ParseWithClaims(tokenStr, claims, func(token *jwt.Token) (interface{}, error) {
					if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
						return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
					}
					return getJWTSecret(), nil
				})
				if err == nil && token.Valid {
					ctx := context.WithValue(r.Context(), userContextKey, &UserContext{
						UserID:   claims.UserID,
						Username: claims.Username,
					})
					r = r.WithContext(ctx)
				}
			}
		}
		next(w, r)
	}
}

func getUserFromContext(r *http.Request) (*UserContext, bool) {
	u, ok := r.Context().Value(userContextKey).(*UserContext)
	return u, ok
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

	res, err := db.Exec("INSERT INTO users (username, password_hash) VALUES (?, ?)", req.Username, string(hashedPassword))
	if err != nil {
		if strings.Contains(err.Error(), "UNIQUE constraint failed") {
			http.Error(w, "Username already exists", http.StatusConflict)
			return
		}
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	userID, _ := res.LastInsertId()
	tokenString, err := generateToken(int(userID), req.Username)
	if err != nil {
		http.Error(w, "Error generating JWT token", http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(map[string]string{
		"message":  "Registration successful",
		"token":    tokenString,
		"username": req.Username,
	})
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

	tokenString, err := generateToken(user.ID, user.Username)
	if err != nil {
		http.Error(w, "Error generating JWT authentication token", http.StatusInternalServerError)
		return
	}

	json.NewEncoder(w).Encode(map[string]string{
		"token":    tokenString,
		"username": user.Username,
	})
}

func profileHandler(w http.ResponseWriter, r *http.Request) {
	uCtx, ok := getUserFromContext(r)
	if !ok || uCtx.Username == "" {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}
	username := uCtx.Username

	// Fetch user details
	var email, fullName, phone, area, shelfName, bio, profileImage, createdAt, updatedAt string
	var locationSharingEnabledVal int
	var latitude, longitude float64
	err := db.QueryRow("SELECT COALESCE(email, ''), COALESCE(full_name, ''), COALESCE(phone, ''), COALESCE(area, ''), COALESCE(shelf_name, ''), COALESCE(bio, ''), COALESCE(profile_image, ''), location_sharing_enabled, latitude, longitude, COALESCE(created_at, ''), COALESCE(updated_at, '') FROM users WHERE username = ?", username).Scan(&email, &fullName, &phone, &area, &shelfName, &bio, &profileImage, &locationSharingEnabledVal, &latitude, &longitude, &createdAt, &updatedAt)
	if err != nil {
		email = ""
		fullName = username
		phone = ""
		area = ""
		shelfName = username + "'s Shelf"
		bio = ""
		profileImage = ""
		locationSharingEnabledVal = 0
		latitude = 0.0
		longitude = 0.0
		createdAt = ""
		updatedAt = ""
	}
	if fullName == "" {
		fullName = username
	}
	if shelfName == "" {
		shelfName = username + "'s Shelf"
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

	// Compute dynamic counts from DB
	var totalBorrowedCount, totalLentCount int
	_ = db.QueryRow("SELECT (SELECT COUNT(*) FROM borrow_requests WHERE borrower_username = ?) + (SELECT COUNT(*) FROM borrowed_items WHERE username = ?)", username, username).Scan(&totalBorrowedCount)
	_ = db.QueryRow("SELECT (SELECT COUNT(*) FROM borrow_requests WHERE lender_username = ?) + (SELECT COUNT(*) FROM lent_items WHERE username = ?)", username, username).Scan(&totalLentCount)

	json.NewEncoder(w).Encode(map[string]interface{}{
		"username":               username,
		"email":                  email,
		"fullName":               fullName,
		"phone":                  phone,
		"area":                   area,
		"shelfName":              shelfName,
		"bio":                    bio,
		"profileImage":           profileImage,
		"locationSharingEnabled": locationSharingEnabledVal == 1,
		"latitude":               latitude,
		"longitude":              longitude,
		"createdAt":              createdAt,
		"updatedAt":              updatedAt,
		"borrowed":               borrowed,
		"lent":                   lent,
		"totalBorrowedCount":     totalBorrowedCount,
		"totalLentCount":         totalLentCount,
		"activeItemsCount":       len(borrowed) + len(lent),
	})
}

func publicProfileHandler(w http.ResponseWriter, r *http.Request) {
	targetUser := strings.TrimSpace(r.URL.Query().Get("username"))
	if targetUser == "" {
		http.Error(w, "Username query parameter required", http.StatusBadRequest)
		return
	}

	var fullName, area, shelfName, bio, profileImage, createdAt string
	err := db.QueryRow(
		"SELECT COALESCE(NULLIF(full_name, ''), username), COALESCE(area, ''), COALESCE(NULLIF(shelf_name, ''), username || '''s Shelf'), COALESCE(bio, ''), COALESCE(profile_image, ''), COALESCE(created_at, '') FROM users WHERE username = ?",
		targetUser,
	).Scan(&fullName, &area, &shelfName, &bio, &profileImage, &createdAt)

	if err != nil {
		if err == sql.ErrNoRows {
			http.Error(w, "User not found", http.StatusNotFound)
			return
		}
		http.Error(w, "Database error", http.StatusInternalServerError)
		return
	}

	// Fetch public lent items (My Shelf)
	rowsLent, err := db.Query("SELECT id, item_name, status, category, description, created_at FROM lent_items WHERE username = ?", targetUser)
	lent := []LentItem{}
	if err == nil {
		defer rowsLent.Close()
		for rowsLent.Next() {
			var item LentItem
			item.Username = targetUser
			if err := rowsLent.Scan(&item.ID, &item.ItemName, &item.Status, &item.Category, &item.Description, &item.CreatedAt); err == nil {
				lent = append(lent, item)
			}
		}
	}

	json.NewEncoder(w).Encode(map[string]interface{}{
		"username":     targetUser,
		"fullName":     fullName,
		"area":         area,
		"shelfName":    shelfName,
		"bio":          bio,
		"profileImage": profileImage,
		"createdAt":    createdAt,
		"lent":         lent,
	})
}

func setupProfileHandler(w http.ResponseWriter, r *http.Request) {
	uCtx, ok := getUserFromContext(r)
	if !ok || uCtx.Username == "" {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}
	username := uCtx.Username

	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req SetupProfileRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Bad request", http.StatusBadRequest)
		return
	}

	req.FullName = strings.TrimSpace(req.FullName)
	req.Email = strings.TrimSpace(req.Email)
	req.Phone = strings.TrimSpace(req.Phone)
	req.Area = strings.TrimSpace(req.Area)
	req.ShelfName = strings.TrimSpace(req.ShelfName)
	req.Bio = strings.TrimSpace(req.Bio)
	req.ProfileImage = strings.TrimSpace(req.ProfileImage)

	if req.FullName == "" {
		req.FullName = username
	}
	if req.ShelfName == "" {
		req.ShelfName = username + "'s Shelf"
	}

	_, err := db.Exec(
		"UPDATE users SET full_name = ?, email = ?, phone = ?, area = ?, shelf_name = ?, bio = ?, profile_image = ?, updated_at = datetime('now') WHERE username = ?",
		req.FullName, req.Email, req.Phone, req.Area, req.ShelfName, req.Bio, req.ProfileImage, username,
	)
	if err != nil {
		http.Error(w, "Database error: "+err.Error(), http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]string{
		"message": "Profile updated successfully",
	})
}

func borrowHandler(w http.ResponseWriter, r *http.Request) {
	uCtx, ok := getUserFromContext(r)
	if !ok || uCtx.Username == "" {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}
	username := uCtx.Username

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
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	r.Body = http.MaxBytesReader(w, r.Body, 12<<20)

	var req LendRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Bad request", http.StatusBadRequest)
		return
	}

	req.ItemName = strings.TrimSpace(req.ItemName)
	if req.ItemName == "" {
		http.Error(w, "Item name is required", http.StatusBadRequest)
		return
	}

	username := ""
	if uCtx, ok := getUserFromContext(r); ok && uCtx != nil && uCtx.Username != "" {
		username = uCtx.Username
	} else if strings.TrimSpace(req.LenderName) != "" {
		username = strings.TrimSpace(req.LenderName)
	} else {
		username = "Padosi"
	}

	lenderName := strings.TrimSpace(req.LenderName)
	if lenderName == "" {
		lenderName = username
	}

	category := strings.TrimSpace(req.Category)
	if category == "" {
		category = "Other"
	}

	area := strings.TrimSpace(req.Area)
	if area == "" {
		area = "Mohalla"
	}

	duration := strings.TrimSpace(req.Duration)
	if duration == "" {
		duration = "7 Days"
	}

	condition := strings.TrimSpace(req.Condition)
	if condition == "" {
		condition = "Good Working 👍"
	}

	imageURL, err := persistItemImage(req.ImageUrl)
	if err != nil {
		log.Printf("lend image persist error: %v", err)
		http.Error(w, "Could not save item photo", http.StatusBadRequest)
		return
	}

	res, err := db.Exec(
		`INSERT INTO lent_items (
			username, item_name, status, category, description,
			lender_name, area, phone, duration, condition, image_url, created_at
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
		username, req.ItemName, "active", category, req.Description,
		lenderName, area, req.Phone, duration, condition, imageURL,
	)
	if err != nil {
		http.Error(w, "Database error: "+err.Error(), http.StatusInternalServerError)
		return
	}

	insertedID, _ := res.LastInsertId()

	item := LentItem{
		ID:          int(insertedID),
		Username:    username,
		ItemName:    req.ItemName,
		ItemNameAlt: req.ItemName,
		Status:      "active",
		Category:    category,
		Description: req.Description,
		LenderName:  lenderName,
		Area:        area,
		Phone:       req.Phone,
		Duration:    duration,
		Condition:   condition,
		ImageUrl:    imageURL,
		CreatedAt:   time.Now().Format("2006-01-02 15:04:05"),
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"message": "Item put up for lending successfully",
		"id":      insertedID,
		"item":    item,
	})
}

func getItemsHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	rows, err := db.Query(`SELECT 
		id, username, item_name, status, category, description,
		COALESCE(lender_name, username), COALESCE(area, 'Nearby'), COALESCE(phone, ''),
		COALESCE(duration, '7 Days'), COALESCE(condition, 'Good Working 👍'), COALESCE(image_url, ''),
		created_at 
		FROM lent_items ORDER BY id DESC`)
	if err != nil {
		http.Error(w, "Database error", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var items []LentItem
	for rows.Next() {
		var item LentItem
		if err := rows.Scan(
			&item.ID, &item.Username, &item.ItemName, &item.Status, &item.Category, &item.Description,
			&item.LenderName, &item.Area, &item.Phone,
			&item.Duration, &item.Condition, &item.ImageUrl,
			&item.CreatedAt,
		); err == nil {
			item.ItemNameAlt = item.ItemName
			if item.LenderName == "" {
				item.LenderName = item.Username
			}
			if item.Area == "" {
				item.Area = "Nearby"
			}
			items = append(items, item)
		}
	}
	if err := rows.Err(); err != nil {
		http.Error(w, "Database error during iteration", http.StatusInternalServerError)
		return
	}

	json.NewEncoder(w).Encode(items)
}



func updateLocationHandler(w http.ResponseWriter, r *http.Request) {
	uCtx, ok := getUserFromContext(r)
	if !ok || uCtx.Username == "" {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}
	username := uCtx.Username

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

func createBorrowRequestHandler(w http.ResponseWriter, r *http.Request) {
	uCtx, ok := getUserFromContext(r)
	if !ok || uCtx.Username == "" {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req CreateBorrowRequestInput
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Bad request", http.StatusBadRequest)
		return
	}

	req.ItemID = strings.TrimSpace(req.ItemID)
	req.ItemName = strings.TrimSpace(req.ItemName)
	req.Lender = strings.TrimSpace(req.Lender)
	req.Note = strings.TrimSpace(req.Note)

	if req.ItemID == "" || req.ItemName == "" || req.Lender == "" {
		http.Error(w, "ItemID, ItemName, and Lender are required", http.StatusBadRequest)
		return
	}

	if strings.EqualFold(req.Lender, uCtx.Username) {
		http.Error(w, "You cannot borrow your own item", http.StatusBadRequest)
		return
	}

	// Check if a request already exists in pending or accepted state
	var existingID int
	err := db.QueryRow(
		"SELECT id FROM borrow_requests WHERE borrower_username = ? AND lender_username = ? AND item_id = ? AND status IN ('pending', 'accepted')",
		uCtx.Username, req.Lender, req.ItemID,
	).Scan(&existingID)
	if err == nil {
		http.Error(w, "A borrow request for this item is already pending or accepted", http.StatusConflict)
		return
	}

	res, err := db.Exec(
		"INSERT INTO borrow_requests (item_id, item_name, borrower_username, lender_username, status, note, created_at, updated_at) VALUES (?, ?, ?, ?, 'pending', ?, datetime('now'), datetime('now'))",
		req.ItemID, req.ItemName, uCtx.Username, req.Lender, req.Note,
	)
	if err != nil {
		http.Error(w, "Database error: "+err.Error(), http.StatusInternalServerError)
		return
	}

	lastID, _ := res.LastInsertId()
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"message": "Borrow request sent successfully",
		"id":      lastID,
		"status":  "pending",
	})
}

func getBorrowRequestsHandler(w http.ResponseWriter, r *http.Request) {
	uCtx, ok := getUserFromContext(r)
	if !ok || uCtx.Username == "" {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	rows, err := db.Query(`
		SELECT 
			br.id, br.item_id, br.item_name, br.borrower_username, br.lender_username, br.status, br.note, br.created_at, br.updated_at,
			c.id
		FROM borrow_requests br
		LEFT JOIN conversations c ON br.id = c.borrow_request_id
		WHERE br.borrower_username = ? OR br.lender_username = ?
		ORDER BY br.id DESC
	`, uCtx.Username, uCtx.Username)
	if err != nil {
		http.Error(w, "Database error", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var list []BorrowRequestRecord
	for rows.Next() {
		var rec BorrowRequestRecord
		var convID sql.NullInt64
		err = rows.Scan(&rec.ID, &rec.ItemID, &rec.ItemName, &rec.BorrowerUsername, &rec.LenderUsername, &rec.Status, &rec.Note, &rec.CreatedAt, &rec.UpdatedAt, &convID)
		if err != nil {
			continue
		}
		if convID.Valid {
			cID := int(convID.Int64)
			rec.ConversationID = &cID
		}
		list = append(list, rec)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(list)
}

func acceptBorrowRequestHandler(w http.ResponseWriter, r *http.Request) {
	uCtx, ok := getUserFromContext(r)
	if !ok || uCtx.Username == "" {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req AcceptRejectInput
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.RequestID <= 0 {
		http.Error(w, "Invalid requestId", http.StatusBadRequest)
		return
	}

	var lenderUsername, borrowerUsername, itemID, itemName, status string
	err := db.QueryRow("SELECT lender_username, borrower_username, item_id, item_name, status FROM borrow_requests WHERE id = ?", req.RequestID).
		Scan(&lenderUsername, &borrowerUsername, &itemID, &itemName, &status)
	if err != nil {
		http.Error(w, "Borrow request not found", http.StatusNotFound)
		return
	}

	if !strings.EqualFold(lenderUsername, uCtx.Username) {
		http.Error(w, "Forbidden: Only the lender can accept this borrow request", http.StatusForbidden)
		return
	}

	if status != "pending" {
		http.Error(w, "Borrow request is not pending", http.StatusBadRequest)
		return
	}

	// Update status to accepted
	_, err = db.Exec("UPDATE borrow_requests SET status = 'accepted', updated_at = datetime('now') WHERE id = ?", req.RequestID)
	if err != nil {
		http.Error(w, "Database error", http.StatusInternalServerError)
		return
	}

	// Create conversation
	res, err := db.Exec(
		"INSERT INTO conversations (borrow_request_id, borrower_username, lender_username, item_id, item_name, created_at, updated_at) VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now'))",
		req.RequestID, borrowerUsername, lenderUsername, itemID, itemName,
	)
	var convID int64
	if err != nil {
		// Fetch existing if already created
		_ = db.QueryRow("SELECT id FROM conversations WHERE borrow_request_id = ?", req.RequestID).Scan(&convID)
	} else {
		convID, _ = res.LastInsertId()
	}

	// Also record in borrowed_items table to preserve existing borrowing functionality
	_, _ = db.Exec(
		"INSERT INTO borrowed_items (username, item_id, item_name, lender, days_left, since, note) VALUES (?, ?, ?, ?, 3, 'Just accepted', 'Accepted via Mohalla Store')",
		borrowerUsername, itemID, itemName, lenderUsername,
	)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"message":        "Borrow request accepted successfully",
		"conversationId": convID,
		"status":         "accepted",
	})
}

func rejectBorrowRequestHandler(w http.ResponseWriter, r *http.Request) {
	uCtx, ok := getUserFromContext(r)
	if !ok || uCtx.Username == "" {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req AcceptRejectInput
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.RequestID <= 0 {
		http.Error(w, "Invalid requestId", http.StatusBadRequest)
		return
	}

	var lenderUsername, status string
	err := db.QueryRow("SELECT lender_username, status FROM borrow_requests WHERE id = ?", req.RequestID).Scan(&lenderUsername, &status)
	if err != nil {
		http.Error(w, "Borrow request not found", http.StatusNotFound)
		return
	}

	if !strings.EqualFold(lenderUsername, uCtx.Username) {
		http.Error(w, "Forbidden: Only the lender can reject this borrow request", http.StatusForbidden)
		return
	}

	if status != "pending" {
		http.Error(w, "Borrow request is not pending", http.StatusBadRequest)
		return
	}

	_, err = db.Exec("UPDATE borrow_requests SET status = 'rejected', updated_at = datetime('now') WHERE id = ?", req.RequestID)
	if err != nil {
		http.Error(w, "Database error", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"message": "Borrow request rejected",
		"status":  "rejected",
	})
}

func getConversationsHandler(w http.ResponseWriter, r *http.Request) {
	uCtx, ok := getUserFromContext(r)
	if !ok || uCtx.Username == "" {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	rows, err := db.Query(`
		SELECT id, borrow_request_id, borrower_username, lender_username, item_id, item_name, created_at, updated_at
		FROM conversations
		WHERE borrower_username = ? OR lender_username = ?
		ORDER BY updated_at DESC
	`, uCtx.Username, uCtx.Username)
	if err != nil {
		http.Error(w, "Database error", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var list []ConversationRecord
	for rows.Next() {
		var c ConversationRecord
		err = rows.Scan(&c.ID, &c.BorrowRequestID, &c.BorrowerUsername, &c.LenderUsername, &c.ItemID, &c.ItemName, &c.CreatedAt, &c.UpdatedAt)
		if err != nil {
			continue
		}

		if strings.EqualFold(c.BorrowerUsername, uCtx.Username) {
			c.OtherUser = c.LenderUsername
		} else {
			c.OtherUser = c.BorrowerUsername
		}

		// Get last message
		var lastMsg string
		var lastTime string
		_ = db.QueryRow("SELECT content, created_at FROM messages WHERE conversation_id = ? ORDER BY id DESC LIMIT 1", c.ID).Scan(&lastMsg, &lastTime)
		c.LastMessage = lastMsg
		c.LastMessageTime = lastTime

		// Get unread count
		var unread int
		_ = db.QueryRow("SELECT COUNT(*) FROM messages WHERE conversation_id = ? AND sender_username != ? AND read_at IS NULL", c.ID, uCtx.Username).Scan(&unread)
		c.UnreadCount = unread

		list = append(list, c)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(list)
}

func getMessagesHandler(w http.ResponseWriter, r *http.Request) {
	uCtx, ok := getUserFromContext(r)
	if !ok || uCtx.Username == "" {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	convIDStr := r.URL.Query().Get("conversationId")
	convID, err := strconv.Atoi(convIDStr)
	if err != nil || convID <= 0 {
		http.Error(w, "Invalid conversationId", http.StatusBadRequest)
		return
	}

	// Verify authorization
	var count int
	err = db.QueryRow("SELECT COUNT(*) FROM conversations WHERE id = ? AND (borrower_username = ? OR lender_username = ?)", convID, uCtx.Username, uCtx.Username).Scan(&count)
	if err != nil || count == 0 {
		http.Error(w, "Forbidden: You are not a participant in this conversation", http.StatusForbidden)
		return
	}

	// Mark messages from the other user as read
	_, _ = db.Exec("UPDATE messages SET read_at = datetime('now') WHERE conversation_id = ? AND sender_username != ? AND read_at IS NULL", convID, uCtx.Username)

	rows, err := db.Query("SELECT id, conversation_id, sender_username, content, created_at, read_at FROM messages WHERE conversation_id = ? ORDER BY id ASC", convID)
	if err != nil {
		http.Error(w, "Database error", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var msgs []MessageRecord
	for rows.Next() {
		var m MessageRecord
		var readAtVal sql.NullString
		err = rows.Scan(&m.ID, &m.ConversationID, &m.SenderUsername, &m.Content, &m.CreatedAt, &readAtVal)
		if err != nil {
			continue
		}
		if readAtVal.Valid {
			rTime := readAtVal.String
			m.ReadAt = &rTime
		}
		msgs = append(msgs, m)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(msgs)
}

func postMessageHandler(w http.ResponseWriter, r *http.Request) {
	uCtx, ok := getUserFromContext(r)
	if !ok || uCtx.Username == "" {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var input SendMessageInput
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil || input.ConversationID <= 0 {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	input.Content = strings.TrimSpace(input.Content)
	if input.Content == "" {
		http.Error(w, "Message content cannot be empty", http.StatusBadRequest)
		return
	}

	// Verify user is a participant
	var count int
	err := db.QueryRow("SELECT COUNT(*) FROM conversations WHERE id = ? AND (borrower_username = ? OR lender_username = ?)", input.ConversationID, uCtx.Username, uCtx.Username).Scan(&count)
	if err != nil || count == 0 {
		http.Error(w, "Forbidden: You are not a participant in this conversation", http.StatusForbidden)
		return
	}

	res, err := db.Exec(
		"INSERT INTO messages (conversation_id, sender_username, content, created_at) VALUES (?, ?, ?, datetime('now'))",
		input.ConversationID, uCtx.Username, input.Content,
	)
	if err != nil {
		http.Error(w, "Database error: "+err.Error(), http.StatusInternalServerError)
		return
	}

	_, _ = db.Exec("UPDATE conversations SET updated_at = datetime('now') WHERE id = ?", input.ConversationID)

	msgID, _ := res.LastInsertId()
	var createdAt string
	_ = db.QueryRow("SELECT created_at FROM messages WHERE id = ?", msgID).Scan(&createdAt)

	msgRecord := MessageRecord{
		ID:             int(msgID),
		ConversationID: input.ConversationID,
		SenderUsername: uCtx.Username,
		Content:        input.Content,
		CreatedAt:      createdAt,
	}

	// Broadcast to active WebSocket room connections
	hub.broadcast <- BroadcastMessage{
		ConversationID: input.ConversationID,
		Message:        msgRecord,
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(msgRecord)
}

func wsHandler(w http.ResponseWriter, r *http.Request) {
	tokenStr := r.URL.Query().Get("token")
	if tokenStr == "" {
		authHeader := r.Header.Get("Authorization")
		parts := strings.Split(authHeader, " ")
		if len(parts) == 2 {
			tokenStr = parts[1]
		}
	}

	if tokenStr == "" {
		http.Error(w, "Unauthorized: Missing token", http.StatusUnauthorized)
		return
	}

	claims := &Claims{}
	token, err := jwt.ParseWithClaims(tokenStr, claims, func(token *jwt.Token) (interface{}, error) {
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
		}
		return getJWTSecret(), nil
	})

	if err != nil || !token.Valid || claims.Username == "" {
		http.Error(w, "Unauthorized: Invalid token", http.StatusUnauthorized)
		return
	}

	convIDStr := r.URL.Query().Get("conversationId")
	convID, err := strconv.Atoi(convIDStr)
	if err != nil || convID <= 0 {
		http.Error(w, "Invalid conversationId", http.StatusBadRequest)
		return
	}

	// Verify participant
	var count int
	err = db.QueryRow("SELECT COUNT(*) FROM conversations WHERE id = ? AND (borrower_username = ? OR lender_username = ?)", convID, claims.Username, claims.Username).Scan(&count)
	if err != nil || count == 0 {
		http.Error(w, "Forbidden: Not a participant", http.StatusForbidden)
		return
	}

	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("WebSocket upgrade failed: %v\n", err)
		return
	}

	client := &Client{
		conn:           conn,
		conversationID: convID,
		username:       claims.Username,
	}

	hub.register <- client
	defer func() {
		hub.unregister <- client
	}()

	for {
		_, messageData, err := conn.ReadMessage()
		if err != nil {
			break
		}

		var payload struct {
			Content string `json:"content"`
		}
		if err := json.Unmarshal(messageData, &payload); err != nil {
			continue
		}

		content := strings.TrimSpace(payload.Content)
		if content == "" {
			continue
		}

		res, err := db.Exec(
			"INSERT INTO messages (conversation_id, sender_username, content, created_at) VALUES (?, ?, ?, datetime('now'))",
			convID, claims.Username, content,
		)
		if err != nil {
			continue
		}

		_, _ = db.Exec("UPDATE conversations SET updated_at = datetime('now') WHERE id = ?", convID)

		msgID, _ := res.LastInsertId()
		var createdAt string
		_ = db.QueryRow("SELECT created_at FROM messages WHERE id = ?", msgID).Scan(&createdAt)

		msgRecord := MessageRecord{
			ID:             int(msgID),
			ConversationID: convID,
			SenderUsername: claims.Username,
			Content:        content,
			CreatedAt:      createdAt,
		}

		hub.broadcast <- BroadcastMessage{
			ConversationID: convID,
			Message:        msgRecord,
		}
	}
}

func seedRecommendationData() {
	var count int
	err := db.QueryRow("SELECT COUNT(*) FROM recommendation_posts").Scan(&count)
	if err == nil && count > 0 {
		return
	}

	posts := []struct {
		Title       string
		Description string
		Category    string
		Area        string
		Username    string
		Replies     []struct {
			Username  string
			Content   string
			Helpful   []string
			RecName   string
			RecCat    string
			RecDesc   string
			RecLoc    string
			Endorsers []string
		}
	}{
		{
			Title:       "🧵 Koi acha ladies tailor suggest krdo?",
			Description: "Need someone who actually understands fitting and delivers on time 😭",
			Category:    "Services",
			Area:        "Kalkaji",
			Username:    "Aarav",
			Replies: []struct {
				Username  string
				Content   string
				Helpful   []string
				RecName   string
				RecCat    string
				RecDesc   string
				RecLoc    string
				Endorsers []string
			}{
				{
					Username:  "Riya",
					Content:   "Try Neha Tailors near Central Market! Got two suits altered there and the fitting was spot on.",
					Helpful:   []string{"Aman", "Priya", "Meera", "Kabir", "Ananya", "Vikram", "Karan", "Aarav"},
					RecName:   "Neha Tailors",
					RecCat:    "Tailoring & Alterations",
					RecDesc:   "Specializes in ethnic suits and custom fitting. Honest timelines.",
					RecLoc:    "0.4 km away · Central Market",
					Endorsers: []string{"Aman", "Priya", "Meera", "Kabir", "Ananya", "Vikram"},
				},
				{
					Username:  "Aman",
					Content:   "+1. My family has been going there for years. Ask for Uncle Ji there!",
					Helpful:   []string{"Riya", "Aarav"},
				},
			},
		},
		{
			Title:       "🍜 Best momos around here?",
			Description: "Looking for real street-style momos with spicy red chutney that's actually worth the hype.",
			Category:    "Food",
			Area:        "1.2 km away",
			Username:    "Meera",
			Replies: []struct {
				Username  string
				Content   string
				Helpful   []string
				RecName   string
				RecCat    string
				RecDesc   string
				RecLoc    string
				Endorsers []string
			}{
				{
					Username:  "Kabir",
					Content:   "Mount Abu Momos near Gate 2! Try their steam chicken and fried paneer momos.",
					Helpful:   []string{"Meera", "Riya", "Aman", "Priya", "Karan", "Ananya", "Vikram"},
					RecName:   "Mount Abu Momos",
					RecCat:    "Street Food & Snacks",
					RecDesc:   "Fiery red garlic chutney & juicy steamed momos. Open till 10:30 PM.",
					RecLoc:    "1.1 km away · Gate 2",
					Endorsers: []string{"Meera", "Riya", "Aman", "Priya", "Karan", "Ananya", "Vikram", "Aarav"},
				},
			},
		},
		{
			Title:       "🔧 Reliable electrician needed",
			Description: "Need someone for small wiring fix and fan noise repair. Prefer someone recommended by locals.",
			Category:    "Services",
			Area:        "Sector C",
			Username:    "Vikram",
			Replies: []struct {
				Username  string
				Content   string
				Helpful   []string
				RecName   string
				RecCat    string
				RecDesc   string
				RecLoc    string
				Endorsers []string
			}{
				{
					Username:  "Ananya",
					Content:   "Sharma Electricals is great. Has helped us with wiring and small repairs. Reasonable pricing.",
					Helpful:   []string{"Vikram", "Aarav", "Riya", "Karan", "Priya", "Meera"},
					RecName:   "Sharma Electricals",
					RecCat:    "Electrical Services",
					RecDesc:   "Has helped us with wiring & small repairs. Reasonable pricing.",
					RecLoc:    "0.8 km away · Gali 4",
					Endorsers: []string{"Vikram", "Aarav", "Riya", "Karan", "Priya"},
				},
			},
		},
		{
			Title:       "📚 Good maths tutor for class 10?",
			Description: "Looking for a patient tutor for Class 10 Board exams. Preferred near Kalkaji Extension.",
			Category:    "Education",
			Area:        "Kalkaji Extension",
			Username:    "Priya",
			Replies: []struct {
				Username  string
				Content   string
				Helpful   []string
				RecName   string
				RecCat    string
				RecDesc   string
				RecLoc    string
				Endorsers []string
			}{
				{
					Username:  "Karan",
					Content:   "Gupta Sir near Pocket B library conducts small batches of 5 students. Very attentive and experienced!",
					Helpful:   []string{"Priya", "Aarav", "Ananya", "Vikram"},
					RecName:   "Gupta Maths Academy",
					RecCat:    "Tuition / Education",
					RecDesc:   "Class 9 & 10 Mathematics specialist. Individual attention.",
					RecLoc:    "0.5 km away · Pocket B",
					Endorsers: []string{"Priya", "Aarav", "Ananya", "Vikram"},
				},
			},
		},
		{
			Title:       "💻 Affordable laptop repair shop?",
			Description: "My laptop battery drains quickly and fan makes weird noise. Need trustworthy repair shop.",
			Category:    "Services",
			Area:        "Nehru Place",
			Username:    "Karan",
			Replies: []struct {
				Username  string
				Content   string
				Helpful   []string
				RecName   string
				RecCat    string
				RecDesc   string
				RecLoc    string
				Endorsers []string
			}{
				{
					Username:  "Meera",
					Content:   "Micro Chip Solutions in shop 12. Rahul bhaiya gives honest advice without charging extra.",
					Helpful:   []string{"Karan", "Riya", "Kabir"},
					RecName:   "Micro Chip Solutions",
					RecCat:    "Laptop & Tech Repair",
					RecDesc:   "Genuine spare parts & quick diagnostic.",
					RecLoc:    "1.5 km away",
					Endorsers: []string{"Karan", "Riya", "Kabir"},
				},
			},
		},
		{
			Title:       "💇 Best salon around here for haircut?",
			Description: "Looking for a clean, hygienic salon for quick haircut and beard trim.",
			Category:    "Self Care",
			Area:        "Market Block A",
			Username:    "Riya",
			Replies: []struct {
				Username  string
				Content   string
				Helpful   []string
				RecName   string
				RecCat    string
				RecDesc   string
				RecLoc    string
				Endorsers []string
			}{
				{
					Username:  "Aman",
					Content:   "Style Cut Salon opposite the park. Sanjay does a great job with haircuts.",
					Helpful:   []string{"Riya", "Karan", "Vikram", "Meera"},
					RecName:   "Style Cut Salon",
					RecCat:    "Hair & Grooming",
					RecDesc:   "Clean equipment, prompt service, great hair styling.",
					RecLoc:    "0.3 km away · Block A",
					Endorsers: []string{"Riya", "Karan", "Vikram", "Meera"},
				},
			},
		},
	}

	for _, p := range posts {
		res, err := db.Exec(
			"INSERT INTO recommendation_posts (user_id, username, title, description, category, area, created_at) VALUES (1, ?, ?, ?, ?, ?, datetime('now', '-30 minutes'))",
			p.Username, p.Title, p.Description, p.Category, p.Area,
		)
		if err != nil {
			continue
		}
		postID, _ := res.LastInsertId()

		for _, r := range p.Replies {
			resR, err := db.Exec(
				"INSERT INTO recommendation_replies (post_id, username, content, created_at) VALUES (?, ?, ?, datetime('now', '-15 minutes'))",
				postID, r.Username, r.Content,
			)
			if err != nil {
				continue
			}
			replyID, _ := resR.LastInsertId()

			for _, hUser := range r.Helpful {
				db.Exec("INSERT OR IGNORE INTO recommendation_helpful_votes (reply_id, username) VALUES (?, ?)", replyID, hUser)
			}

			if r.RecName != "" {
				resRec, err := db.Exec(
					"INSERT INTO recommendations (post_id, reply_id, name, category, description, location, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)",
					postID, replyID, r.RecName, r.RecCat, r.RecDesc, r.RecLoc, r.Username,
				)
				if err == nil {
					recID, _ := resRec.LastInsertId()
					for _, eUser := range r.Endorsers {
						db.Exec("INSERT OR IGNORE INTO recommendation_endorsements (recommendation_id, username) VALUES (?, ?)", recID, eUser)
					}
				}
			}
		}
	}
}

func getRecommendationsHandler(w http.ResponseWriter, r *http.Request) {
	category := strings.TrimSpace(r.URL.Query().Get("category"))
	search := strings.TrimSpace(r.URL.Query().Get("search"))

	query := "SELECT id, user_id, username, title, description, category, area, created_at, updated_at FROM recommendation_posts WHERE 1=1"
	args := []interface{}{}

	if category != "" && strings.ToLower(category) != "all" {
		query += " AND (LOWER(category) = LOWER(?))"
		args = append(args, category)
	}

	if search != "" {
		sPattern := "%" + strings.ToLower(search) + "%"
		query += " AND (LOWER(title) LIKE ? OR LOWER(description) LIKE ? OR LOWER(category) LIKE ? OR id IN (SELECT post_id FROM recommendations WHERE LOWER(name) LIKE ? OR LOWER(description) LIKE ?))"
		args = append(args, sPattern, sPattern, sPattern, sPattern, sPattern)
	}

	query += " ORDER BY id DESC"

	rows, err := db.Query(query, args...)
	if err != nil {
		http.Error(w, "Database error: "+err.Error(), http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	posts := []RecommendationPost{}
	for rows.Next() {
		var p RecommendationPost
		if err := rows.Scan(&p.ID, &p.UserID, &p.Username, &p.Title, &p.Description, &p.Category, &p.Area, &p.CreatedAt, &p.UpdatedAt); err == nil {
			db.QueryRow("SELECT COUNT(*) FROM recommendation_replies WHERE post_id = ?", p.ID).Scan(&p.RepliesCount)
			db.QueryRow("SELECT COUNT(DISTINCT username) FROM (SELECT username FROM recommendation_posts WHERE id = ? UNION SELECT username FROM recommendation_replies WHERE post_id = ?)", p.ID, p.ID).Scan(&p.NeighbourCount)

			recRows, err := db.Query("SELECT r.id, r.post_id, r.reply_id, r.name, r.category, r.description, r.location, r.created_by, r.created_at, (SELECT COUNT(*) FROM recommendation_endorsements WHERE recommendation_id = r.id) AS endorsements FROM recommendations r WHERE r.post_id = ?", p.ID)
			if err == nil {
				recs := []StructuredRecommendation{}
				for recRows.Next() {
					var rec StructuredRecommendation
					var addEndorsements int
					if err := recRows.Scan(&rec.ID, &rec.PostID, &rec.ReplyID, &rec.Name, &rec.Category, &rec.Description, &rec.Location, &rec.CreatedBy, &rec.CreatedAt, &addEndorsements); err == nil {
						rec.RecommendedCount = addEndorsements + 1
						recs = append(recs, rec)
					}
				}
				recRows.Close()
				p.Recommendations = recs
			}

			posts = append(posts, p)
		}
	}

	json.NewEncoder(w).Encode(posts)
}

func getRecommendationDetailHandler(w http.ResponseWriter, r *http.Request) {
	idStr := r.URL.Query().Get("id")
	id, err := strconv.Atoi(idStr)
	if err != nil || id <= 0 {
		http.Error(w, "Invalid post ID", http.StatusBadRequest)
		return
	}

	var currentUsername string
	authHeader := r.Header.Get("Authorization")
	if authHeader != "" && strings.HasPrefix(authHeader, "Bearer ") {
		tokenStr := strings.TrimPrefix(authHeader, "Bearer ")
		claims := &Claims{}
		token, err := jwt.ParseWithClaims(tokenStr, claims, func(token *jwt.Token) (interface{}, error) {
			return getJWTSecret(), nil
		})
		if err == nil && token.Valid {
			currentUsername = claims.Username
		}
	}

	var p RecommendationPost
	err = db.QueryRow("SELECT id, user_id, username, title, description, category, area, created_at, updated_at FROM recommendation_posts WHERE id = ?", id).Scan(&p.ID, &p.UserID, &p.Username, &p.Title, &p.Description, &p.Category, &p.Area, &p.CreatedAt, &p.UpdatedAt)
	if err != nil {
		if err == sql.ErrNoRows {
			http.Error(w, "Post not found", http.StatusNotFound)
			return
		}
		http.Error(w, "Database error", http.StatusInternalServerError)
		return
	}

	db.QueryRow("SELECT COUNT(*) FROM recommendation_replies WHERE post_id = ?", p.ID).Scan(&p.RepliesCount)
	db.QueryRow("SELECT COUNT(DISTINCT username) FROM (SELECT username FROM recommendation_posts WHERE id = ? UNION SELECT username FROM recommendation_replies WHERE post_id = ?)", p.ID, p.ID).Scan(&p.NeighbourCount)

	rRows, err := db.Query("SELECT id, post_id, username, content, created_at FROM recommendation_replies WHERE post_id = ? ORDER BY id ASC", p.ID)
	if err == nil {
		replies := []RecommendationReply{}
		for rRows.Next() {
			var rep RecommendationReply
			if err := rRows.Scan(&rep.ID, &rep.PostID, &rep.Username, &rep.Content, &rep.CreatedAt); err == nil {
				db.QueryRow("SELECT COUNT(*) FROM recommendation_helpful_votes WHERE reply_id = ?", rep.ID).Scan(&rep.HelpfulCount)

				if currentUsername != "" {
					var vCount int
					db.QueryRow("SELECT COUNT(*) FROM recommendation_helpful_votes WHERE reply_id = ? AND username = ?", rep.ID, currentUsername).Scan(&vCount)
					rep.HasVotedHelpful = vCount > 0
				}

				var rec StructuredRecommendation
				var addEndorsements int
				recErr := db.QueryRow("SELECT id, post_id, reply_id, name, category, description, location, created_by, created_at, (SELECT COUNT(*) FROM recommendation_endorsements WHERE recommendation_id = recommendations.id) FROM recommendations WHERE reply_id = ?", rep.ID).Scan(&rec.ID, &rec.PostID, &rec.ReplyID, &rec.Name, &rec.Category, &rec.Description, &rec.Location, &rec.CreatedBy, &rec.CreatedAt, &addEndorsements)
				if recErr == nil {
					rec.RecommendedCount = addEndorsements + 1
					if currentUsername != "" {
						var eCount int
						db.QueryRow("SELECT COUNT(*) FROM recommendation_endorsements WHERE recommendation_id = ? AND username = ?", rec.ID, currentUsername).Scan(&eCount)
						rec.HasEndorsed = eCount > 0
					}
					rep.Recommendation = &rec
				}

				replies = append(replies, rep)
			}
		}
		rRows.Close()
		p.Replies = replies
	}

	recRows, err := db.Query("SELECT r.id, r.post_id, r.reply_id, r.name, r.category, r.description, r.location, r.created_by, r.created_at, (SELECT COUNT(*) FROM recommendation_endorsements WHERE recommendation_id = r.id) AS endorsements FROM recommendations r WHERE r.post_id = ?", p.ID)
	if err == nil {
		recs := []StructuredRecommendation{}
		for recRows.Next() {
			var rec StructuredRecommendation
			var addEndorsements int
			if err := recRows.Scan(&rec.ID, &rec.PostID, &rec.ReplyID, &rec.Name, &rec.Category, &rec.Description, &rec.Location, &rec.CreatedBy, &rec.CreatedAt, &addEndorsements); err == nil {
				rec.RecommendedCount = addEndorsements + 1
				if currentUsername != "" {
					var eCount int
					db.QueryRow("SELECT COUNT(*) FROM recommendation_endorsements WHERE recommendation_id = ? AND username = ?", rec.ID, currentUsername).Scan(&eCount)
					rec.HasEndorsed = eCount > 0
				}
				recs = append(recs, rec)
			}
		}
		recRows.Close()
		p.Recommendations = recs
	}

	json.NewEncoder(w).Encode(p)
}

func createRecommendationPostHandler(w http.ResponseWriter, r *http.Request) {
	uCtx, ok := getUserFromContext(r)
	if !ok || uCtx.Username == "" {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	var req CreateRecommendationPostInput
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Bad request", http.StatusBadRequest)
		return
	}

	req.Title = strings.TrimSpace(req.Title)
	req.Description = strings.TrimSpace(req.Description)
	req.Category = strings.TrimSpace(req.Category)
	req.Area = strings.TrimSpace(req.Area)

	if req.Title == "" {
		http.Error(w, "Title is required", http.StatusBadRequest)
		return
	}
	if req.Category == "" {
		req.Category = "General"
	}
	if req.Area == "" {
		req.Area = "Your mohalla"
	}

	res, err := db.Exec(
		"INSERT INTO recommendation_posts (user_id, username, title, description, category, area, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))",
		uCtx.UserID, uCtx.Username, req.Title, req.Description, req.Category, req.Area,
	)
	if err != nil {
		http.Error(w, "Database error: "+err.Error(), http.StatusInternalServerError)
		return
	}

	postID, _ := res.LastInsertId()
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"id":      postID,
		"message": "Post created successfully",
	})
}

func deleteRecommendationPostHandler(w http.ResponseWriter, r *http.Request) {
	uCtx, ok := getUserFromContext(r)
	if !ok || uCtx.Username == "" {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	idStr := r.URL.Query().Get("id")
	id, err := strconv.Atoi(idStr)
	if err != nil || id <= 0 {
		http.Error(w, "Invalid post ID", http.StatusBadRequest)
		return
	}

	var postUsername string
	err = db.QueryRow("SELECT username FROM recommendation_posts WHERE id = ?", id).Scan(&postUsername)
	if err != nil {
		http.Error(w, "Post not found", http.StatusNotFound)
		return
	}

	if postUsername != uCtx.Username {
		http.Error(w, "Forbidden: Cannot delete post created by another user", http.StatusForbidden)
		return
	}

	_, _ = db.Exec("DELETE FROM recommendation_posts WHERE id = ?", id)
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]string{"message": "Post deleted successfully"})
}

func createRecommendationReplyHandler(w http.ResponseWriter, r *http.Request) {
	uCtx, ok := getUserFromContext(r)
	if !ok || uCtx.Username == "" {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	var req CreateRecommendationReplyInput
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Bad request", http.StatusBadRequest)
		return
	}

	req.Content = strings.TrimSpace(req.Content)
	if req.PostID <= 0 || req.Content == "" {
		http.Error(w, "Post ID and content are required", http.StatusBadRequest)
		return
	}

	res, err := db.Exec(
		"INSERT INTO recommendation_replies (post_id, username, content, created_at) VALUES (?, ?, ?, datetime('now'))",
		req.PostID, uCtx.Username, req.Content,
	)
	if err != nil {
		http.Error(w, "Database error: "+err.Error(), http.StatusInternalServerError)
		return
	}
	replyID, _ := res.LastInsertId()

	req.RecName = strings.TrimSpace(req.RecName)
	if req.RecName != "" {
		if req.RecLocation == "" {
			req.RecLocation = "Near you"
		}
		_, _ = db.Exec(
			"INSERT INTO recommendations (post_id, reply_id, name, category, description, location, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))",
			req.PostID, replyID, req.RecName, strings.TrimSpace(req.RecCategory), strings.TrimSpace(req.RecDescription), strings.TrimSpace(req.RecLocation), uCtx.Username,
		)
	}

	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"id":      replyID,
		"message": "Reply created successfully",
	})
}

func toggleHelpfulReplyHandler(w http.ResponseWriter, r *http.Request) {
	uCtx, ok := getUserFromContext(r)
	if !ok || uCtx.Username == "" {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	var req ToggleHelpfulInput
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Bad request", http.StatusBadRequest)
		return
	}

	var count int
	db.QueryRow("SELECT COUNT(*) FROM recommendation_helpful_votes WHERE reply_id = ? AND username = ?", req.ReplyID, uCtx.Username).Scan(&count)

	hasVoted := false
	if count > 0 {
		db.Exec("DELETE FROM recommendation_helpful_votes WHERE reply_id = ? AND username = ?", req.ReplyID, uCtx.Username)
	} else {
		db.Exec("INSERT INTO recommendation_helpful_votes (reply_id, username) VALUES (?, ?)", req.ReplyID, uCtx.Username)
		hasVoted = true
	}

	var newCount int
	db.QueryRow("SELECT COUNT(*) FROM recommendation_helpful_votes WHERE reply_id = ?", req.ReplyID).Scan(&newCount)

	json.NewEncoder(w).Encode(map[string]interface{}{
		"helpfulCount":    newCount,
		"hasVotedHelpful": hasVoted,
	})
}

func endorseRecommendationHandler(w http.ResponseWriter, r *http.Request) {
	uCtx, ok := getUserFromContext(r)
	if !ok || uCtx.Username == "" {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	var req EndorseRecommendationInput
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Bad request", http.StatusBadRequest)
		return
	}

	var count int
	db.QueryRow("SELECT COUNT(*) FROM recommendation_endorsements WHERE recommendation_id = ? AND username = ?", req.RecommendationID, uCtx.Username).Scan(&count)

	hasEndorsed := false
	if count > 0 {
		db.Exec("DELETE FROM recommendation_endorsements WHERE recommendation_id = ? AND username = ?", req.RecommendationID, uCtx.Username)
	} else {
		db.Exec("INSERT INTO recommendation_endorsements (recommendation_id, username) VALUES (?, ?)", req.RecommendationID, uCtx.Username)
		hasEndorsed = true
	}

	var addEndorsements int
	db.QueryRow("SELECT COUNT(*) FROM recommendation_endorsements WHERE recommendation_id = ?", req.RecommendationID).Scan(&addEndorsements)

	json.NewEncoder(w).Encode(map[string]interface{}{
		"recommendedCount": addEndorsements + 1,
		"hasEndorsed":      hasEndorsed,
	})
}

func getMohallaMomentsHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	rows, err := db.Query(`SELECT id, borrow_request_id, borrower_username, lender_username, item_name, item_category, usage_headline, usage_description, thank_you_message, photos, area, created_at FROM mohalla_moments ORDER BY created_at DESC`)
	if err != nil {
		log.Printf("Error querying mohalla_moments: %v", err)
		http.Error(w, "Failed to query moments", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	moments := []MohallaMoment{}
	for rows.Next() {
		var m MohallaMoment
		var photosJSON string
		err := rows.Scan(
			&m.ID,
			&m.BorrowRequestID,
			&m.BorrowerUsername,
			&m.LenderUsername,
			&m.ItemName,
			&m.ItemCategory,
			&m.UsageHeadline,
			&m.UsageDescription,
			&m.ThankYouMessage,
			&photosJSON,
			&m.Area,
			&m.CreatedAt,
		)
		if err != nil {
			log.Printf("Error scanning moment row: %v", err)
			continue
		}
		m.Photos = []string{}
		if photosJSON != "" {
			json.Unmarshal([]byte(photosJSON), &m.Photos)
		}
		moments = append(moments, m)
	}

	var totalBorrowed int
	db.QueryRow(`SELECT (SELECT COUNT(*) FROM borrow_requests WHERE status = 'accepted') + (SELECT COUNT(*) FROM borrowed_items)`).Scan(&totalBorrowed)

	json.NewEncoder(w).Encode(MohallaMomentsResponse{
		Moments:            moments,
		TotalBorrowedCount: totalBorrowed,
	})
}

func createMohallaMomentHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	uCtx, ok := getUserFromContext(r)
	if !ok || uCtx.Username == "" {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	var input CreateMohallaMomentInput
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	input.ItemName = strings.TrimSpace(input.ItemName)
	input.UsageHeadline = strings.TrimSpace(input.UsageHeadline)
	input.UsageDescription = strings.TrimSpace(input.UsageDescription)
	input.ThankYouMessage = strings.TrimSpace(input.ThankYouMessage)
	input.LenderUsername = strings.TrimSpace(input.LenderUsername)
	input.ItemCategory = strings.TrimSpace(input.ItemCategory)
	input.Area = strings.TrimSpace(input.Area)

	if input.ItemName == "" || input.UsageHeadline == "" || input.UsageDescription == "" {
		http.Error(w, "Item name, usage headline, and description are required", http.StatusBadRequest)
		return
	}

	if input.ItemCategory == "" {
		input.ItemCategory = "Borrowed Item"
	}
	if input.LenderUsername == "" {
		input.LenderUsername = "Neighbour"
	}
	if input.Area == "" || input.Area == "Your Mohalla" {
		var userArea string
		_ = db.QueryRow("SELECT COALESCE(area, '') FROM users WHERE username = ?", uCtx.Username).Scan(&userArea)
		if userArea != "" {
			input.Area = userArea
		} else {
			input.Area = "NEARBY"
		}
	}

	if input.Photos == nil {
		input.Photos = []string{}
	}

	photosJSON, _ := json.Marshal(input.Photos)

	res, err := db.Exec(`INSERT INTO mohalla_moments (borrow_request_id, borrower_username, lender_username, item_name, item_category, usage_headline, usage_description, thank_you_message, photos, area) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		input.BorrowRequestID,
		uCtx.Username,
		input.LenderUsername,
		input.ItemName,
		input.ItemCategory,
		input.UsageHeadline,
		input.UsageDescription,
		input.ThankYouMessage,
		string(photosJSON),
		input.Area,
	)

	if err != nil {
		log.Printf("Error creating mohalla_moment: %v", err)
		http.Error(w, "Failed to create moment: "+err.Error(), http.StatusInternalServerError)
		return
	}

	id, _ := res.LastInsertId()
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"id":      id,
		"message": "Mohalla Moment published successfully",
	})
}

func main() {
	initDB()
	defer db.Close()

	go hub.run()

	allowedOrigin := os.Getenv("ALLOWED_ORIGIN")
	if allowedOrigin == "" {
		allowedOrigin = "*"
	}

	corsMiddleware := func(next http.HandlerFunc) http.HandlerFunc {
		return func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("Access-Control-Allow-Origin", allowedOrigin)
			w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
			w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
			if r.Method == "OPTIONS" {
				w.WriteHeader(http.StatusOK)
				return
			}
			next(w, r)
		}
	}

	http.HandleFunc("/api/register", corsMiddleware(registerHandler))
	http.HandleFunc("/api/login", corsMiddleware(loginHandler))
	http.HandleFunc("/api/profile", corsMiddleware(JWTMiddleware(profileHandler)))
	http.HandleFunc("/api/profile/public", corsMiddleware(publicProfileHandler))
	http.HandleFunc("/api/borrow", corsMiddleware(JWTMiddleware(borrowHandler)))
	http.HandleFunc("/api/lend", corsMiddleware(OptionalJWTMiddleware(lendHandler)))
	http.HandleFunc("/api/items", corsMiddleware(getItemsHandler))

	uploadFS := http.StripPrefix("/uploads/", http.FileServer(http.Dir("./uploads")))
	http.HandleFunc("/uploads/", corsMiddleware(func(w http.ResponseWriter, r *http.Request) {
		uploadFS.ServeHTTP(w, r)
	}))
	http.HandleFunc("/api/setup_profile", corsMiddleware(JWTMiddleware(setupProfileHandler)))
	http.HandleFunc("/api/user/location", corsMiddleware(JWTMiddleware(updateLocationHandler)))
	http.HandleFunc("/api/radar/items", corsMiddleware(radarItemsHandler))

	// Borrow Requests & Chat APIs
	http.HandleFunc("/api/borrow-requests", corsMiddleware(JWTMiddleware(func(w http.ResponseWriter, r *http.Request) {
		if r.Method == http.MethodPost {
			createBorrowRequestHandler(w, r)
		} else if r.Method == http.MethodGet {
			getBorrowRequestsHandler(w, r)
		} else {
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		}
	})))
	http.HandleFunc("/api/borrow-requests/accept", corsMiddleware(JWTMiddleware(acceptBorrowRequestHandler)))
	http.HandleFunc("/api/borrow-requests/reject", corsMiddleware(JWTMiddleware(rejectBorrowRequestHandler)))
	http.HandleFunc("/api/conversations", corsMiddleware(JWTMiddleware(getConversationsHandler)))
	http.HandleFunc("/api/conversations/messages", corsMiddleware(JWTMiddleware(func(w http.ResponseWriter, r *http.Request) {
		if r.Method == http.MethodGet {
			getMessagesHandler(w, r)
		} else if r.Method == http.MethodPost {
			postMessageHandler(w, r)
		} else {
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		}
	})))
	http.HandleFunc("/api/conversations/ws", wsHandler)

	// Recommendations APIs
	http.HandleFunc("/api/recommendations", corsMiddleware(func(w http.ResponseWriter, r *http.Request) {
		if r.Method == http.MethodGet {
			getRecommendationsHandler(w, r)
		} else if r.Method == http.MethodPost {
			JWTMiddleware(createRecommendationPostHandler)(w, r)
		} else if r.Method == http.MethodDelete {
			JWTMiddleware(deleteRecommendationPostHandler)(w, r)
		} else {
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		}
	}))
	http.HandleFunc("/api/recommendations/detail", corsMiddleware(getRecommendationDetailHandler))
	http.HandleFunc("/api/recommendations/reply", corsMiddleware(JWTMiddleware(createRecommendationReplyHandler)))
	http.HandleFunc("/api/recommendations/reply/helpful", corsMiddleware(JWTMiddleware(toggleHelpfulReplyHandler)))
	http.HandleFunc("/api/recommendations/endorse", corsMiddleware(JWTMiddleware(endorseRecommendationHandler)))

	// Mohalla Moments APIs
	http.HandleFunc("/api/moments", corsMiddleware(func(w http.ResponseWriter, r *http.Request) {
		if r.Method == http.MethodGet {
			getMohallaMomentsHandler(w, r)
		} else if r.Method == http.MethodPost {
			JWTMiddleware(createMohallaMomentHandler)(w, r)
		} else {
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		}
	}))

	port := os.Getenv("PORT")
	if port == "" {
		port = "8085"
	}
	log.Printf("Backend server running on http://localhost:%s\n", port)
	log.Fatal(http.ListenAndServe(":"+port, nil))
}


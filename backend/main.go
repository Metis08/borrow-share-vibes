package main

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"math"
	"net/http"
	"os"
	"sort"
	"strconv"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	"cloud.google.com/go/firestore"
	"github.com/golang-jwt/jwt/v5"
	"github.com/gorilla/websocket"
	_ "github.com/mattn/go-sqlite3"
	"golang.org/x/crypto/bcrypt"
	"google.golang.org/api/iterator"
)

var db *sql.DB

func isProductionMode() bool {
	env := strings.ToLower(strings.TrimSpace(os.Getenv("ENV")))
	if env == "production" || env == "prod" {
		return true
	}
	appEnv := strings.ToLower(strings.TrimSpace(os.Getenv("APP_ENV")))
	if appEnv == "production" || appEnv == "prod" {
		return true
	}
	nodeEnv := strings.ToLower(strings.TrimSpace(os.Getenv("NODE_ENV")))
	return nodeEnv == "production" || nodeEnv == "prod"
}

func getJWTSecret() []byte {
	secret := strings.TrimSpace(os.Getenv("JWT_SECRET"))
	if secret == "" {
		if isProductionMode() {
			log.Fatalf("[FATAL] Production deployment requires a non-empty JWT_SECRET environment variable.")
		}
		secret = "mohalla_dev_secret_key_change_in_production_2026"
	} else if isProductionMode() && (secret == "your_super_secret_jwt_key_here_change_in_production" || secret == "mohalla_dev_secret_key_change_in_production_2026") {
		log.Fatalf("[FATAL] Production deployment detected but default placeholder JWT_SECRET is still in use. Set a unique, secure JWT_SECRET.")
	}
	return []byte(secret)
}

func isSQLiteFallbackDisabled() bool {
	val := strings.ToLower(strings.TrimSpace(os.Getenv("DISABLE_SQLITE_FALLBACK")))
	if val == "true" || val == "1" {
		return true
	}
	useFs := strings.ToLower(strings.TrimSpace(os.Getenv("USE_FIRESTORE")))
	if useFs == "true" || useFs == "1" {
		return true
	}
	return false
}

func isLocalStorageFallbackDisabled() bool {
	val := strings.ToLower(strings.TrimSpace(os.Getenv("DISABLE_LOCAL_STORAGE_FALLBACK")))
	return val == "true" || val == "1"
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
	ID          interface{} `json:"id"`
	Username    string      `json:"username"`
	UserID      interface{} `json:"userId,omitempty"`
	ItemName    string      `json:"itemName"`
	ItemNameAlt string      `json:"item_name,omitempty"`
	Status      string      `json:"status"`
	Category    string      `json:"category"`
	Description string      `json:"description"`
	LenderName  string      `json:"lenderName"`
	Area        string      `json:"area"`
	Phone       string      `json:"phone"`
	Duration    string      `json:"duration"`
	Condition   string      `json:"condition"`
	ImageUrl    string      `json:"imageUrl"`
	Latitude    float64     `json:"latitude,omitempty"`
	Longitude   float64     `json:"longitude,omitempty"`
	CreatedAt   string      `json:"createdAt"`
	UpdatedAt   string      `json:"updatedAt,omitempty"`
}

type FirestoreItem struct {
	ID           string    `firestore:"id" json:"id"`
	UserID       string    `firestore:"userId" json:"userId"`
	Username     string    `firestore:"username" json:"username"`
	LenderName   string    `firestore:"lenderName" json:"lenderName"`
	ItemName     string    `firestore:"itemName" json:"itemName"`
	ItemNameAlt  string    `firestore:"-" json:"item_name,omitempty"`
	Description  string    `firestore:"description" json:"description"`
	Category     string    `firestore:"category" json:"category"`
	Condition    string    `firestore:"condition" json:"condition"`
	Availability string    `firestore:"availability" json:"availability"`
	Status       string    `firestore:"status" json:"status"`
	Area         string    `firestore:"area" json:"area"`
	Phone        string    `firestore:"phone" json:"phone"`
	Duration     string    `firestore:"duration" json:"duration"`
	Latitude     float64   `firestore:"latitude" json:"latitude"`
	Longitude    float64   `firestore:"longitude" json:"longitude"`
	ImageUrl     string    `firestore:"imageUrl" json:"imageUrl"`
	CreatedAt    time.Time `firestore:"createdAt" json:"createdAt"`
	UpdatedAt    time.Time `firestore:"updatedAt" json:"updatedAt"`
}

type FirestoreUser struct {
	ID                     int       `firestore:"id" json:"id"`
	UserID                 string    `firestore:"userId" json:"userId"`
	Username               string    `firestore:"username" json:"username"`
	Email                  string    `firestore:"email" json:"email"`
	FullName               string    `firestore:"fullName" json:"fullName"`
	PasswordHash           string    `firestore:"passwordHash" json:"-"`
	Phone                  string    `firestore:"phone" json:"phone"`
	Area                   string    `firestore:"area" json:"area"`
	ShelfName              string    `firestore:"shelfName" json:"shelfName"`
	Bio                    string    `firestore:"bio" json:"bio"`
	ProfileImage           string    `firestore:"profileImage" json:"profileImage"`
	LocationSharingEnabled bool      `firestore:"locationSharingEnabled" json:"locationSharingEnabled"`
	Latitude               float64   `firestore:"latitude" json:"latitude"`
	Longitude              float64   `firestore:"longitude" json:"longitude"`
	CreatedAt              time.Time `firestore:"createdAt" json:"createdAt"`
	UpdatedAt              time.Time `firestore:"updatedAt" json:"updatedAt"`
}

type FirestoreBorrowRequest struct {
	ID               int       `firestore:"id" json:"id"`
	DocID            string    `firestore:"docId" json:"docId"`
	ItemID           string    `firestore:"itemId" json:"itemId"`
	ItemName         string    `firestore:"itemName" json:"itemName"`
	BorrowerUsername string    `firestore:"borrowerUsername" json:"borrowerUsername"`
	LenderUsername   string    `firestore:"lenderUsername" json:"lenderUsername"`
	Status           string    `firestore:"status" json:"status"`
	Note             string    `firestore:"note" json:"note"`
	ConversationID   *int      `firestore:"conversationId,omitempty" json:"conversationId,omitempty"`
	CreatedAt        time.Time `firestore:"createdAt" json:"createdAt"`
	UpdatedAt        time.Time `firestore:"updatedAt" json:"updatedAt"`
}

type FirestoreBorrowedItem struct {
	ID              int       `firestore:"id" json:"id"`
	DocID           string    `firestore:"docId" json:"docId"`
	Username        string    `firestore:"username" json:"username"`
	ItemID          string    `firestore:"itemId" json:"itemId"`
	ItemName        string    `firestore:"itemName" json:"itemName"`
	Lender          string    `firestore:"lender" json:"lender"`
	DaysLeft        int       `firestore:"daysLeft" json:"daysLeft"`
	Since           string    `firestore:"since" json:"since"`
	Note            string    `firestore:"note" json:"note"`
	BorrowRequestID int       `firestore:"borrowRequestId" json:"borrowRequestId"`
	CreatedAt       time.Time `firestore:"createdAt" json:"createdAt"`
}

type FirestoreLentItem struct {
	ID               int       `firestore:"id" json:"id"`
	DocID            string    `firestore:"docId" json:"docId"`
	Username         string    `firestore:"username" json:"username"`
	BorrowerUsername string    `firestore:"borrowerUsername" json:"borrowerUsername"`
	ItemID           string    `firestore:"itemId" json:"itemId"`
	ItemName         string    `firestore:"itemName" json:"itemName"`
	Status           string    `firestore:"status" json:"status"`
	Category         string    `firestore:"category" json:"category"`
	Description      string    `firestore:"description" json:"description"`
	LenderName       string    `firestore:"lenderName" json:"lenderName"`
	Area             string    `firestore:"area" json:"area"`
	Phone            string    `firestore:"phone" json:"phone"`
	Duration         string    `firestore:"duration" json:"duration"`
	Condition        string    `firestore:"condition" json:"condition"`
	ImageUrl         string    `firestore:"imageUrl" json:"imageUrl"`
	BorrowRequestID  int       `firestore:"borrowRequestId" json:"borrowRequestId"`
	CreatedAt        time.Time `firestore:"createdAt" json:"createdAt"`
}

type FirestoreConversation struct {
	ID               int       `firestore:"id" json:"id"`
	DocID            string    `firestore:"docId" json:"docId"`
	BorrowRequestID  int       `firestore:"borrowRequestId" json:"borrowRequestId"`
	BorrowerUsername string    `firestore:"borrowerUsername" json:"borrowerUsername"`
	LenderUsername   string    `firestore:"lenderUsername" json:"lenderUsername"`
	ItemID           string    `firestore:"itemId" json:"itemId"`
	ItemName         string    `firestore:"itemName" json:"itemName"`
	LastMessage      string    `firestore:"lastMessage" json:"lastMessage"`
	LastMessageTime  string    `firestore:"lastMessageTime" json:"lastMessageTime"`
	CreatedAt        time.Time `firestore:"createdAt" json:"createdAt"`
	UpdatedAt        time.Time `firestore:"updatedAt" json:"updatedAt"`
}

type FirestoreMessage struct {
	ID               int        `firestore:"id" json:"id"`
	DocID            string     `firestore:"docId" json:"docId"`
	ConversationID   int        `firestore:"conversationId" json:"conversationId"`
	SenderUsername   string     `firestore:"senderUsername" json:"senderUsername"`
	ReceiverUsername string     `firestore:"receiverUsername" json:"receiverUsername"`
	Content          string     `firestore:"content" json:"content"`
	CreatedAt        time.Time  `firestore:"createdAt" json:"createdAt"`
	ReadAt           *time.Time `firestore:"readAt,omitempty" json:"readAt,omitempty"`
}

type FirestoreRecommendationPost struct {
	ID          int       `firestore:"id" json:"id"`
	DocID       string    `firestore:"docId" json:"docId"`
	UserID      int       `firestore:"userId" json:"userId"`
	Username    string    `firestore:"username" json:"username"`
	Title       string    `firestore:"title" json:"title"`
	Description string    `firestore:"description" json:"description"`
	Category    string    `firestore:"category" json:"category"`
	Area        string    `firestore:"area" json:"area"`
	CreatedAt   time.Time `firestore:"createdAt" json:"createdAt"`
	UpdatedAt   time.Time `firestore:"updatedAt" json:"updatedAt"`
}

type FirestoreRecommendationReply struct {
	ID             int       `firestore:"id" json:"id"`
	DocID          string    `firestore:"docId" json:"docId"`
	PostID         int       `firestore:"postId" json:"postId"`
	Username       string    `firestore:"username" json:"username"`
	Content        string    `firestore:"content" json:"content"`
	RecName        string    `firestore:"recName" json:"recName"`
	RecCategory    string    `firestore:"recCategory" json:"recCategory"`
	RecDescription string    `firestore:"recDescription" json:"recDescription"`
	RecLocation    string    `firestore:"recLocation" json:"recLocation"`
	CreatedAt      time.Time `firestore:"createdAt" json:"createdAt"`
}

type FirestoreStructuredRecommendation struct {
	ID          int       `firestore:"id" json:"id"`
	DocID       string    `firestore:"docId" json:"docId"`
	PostID      int       `firestore:"postId" json:"postId"`
	ReplyID     int       `firestore:"replyId" json:"replyId"`
	Name        string    `firestore:"name" json:"name"`
	Category    string    `firestore:"category" json:"category"`
	Description string    `firestore:"description" json:"description"`
	Location    string    `firestore:"location" json:"location"`
	CreatedBy   string    `firestore:"createdBy" json:"createdBy"`
	CreatedAt   time.Time `firestore:"createdAt" json:"createdAt"`
}

type FirestoreMohallaMoment struct {
	ID               int       `firestore:"id" json:"id"`
	DocID            string    `firestore:"docId" json:"docId"`
	BorrowRequestID  int       `firestore:"borrowRequestId" json:"borrowRequestId"`
	BorrowerUsername string    `firestore:"borrowerUsername" json:"borrowerUsername"`
	LenderUsername   string    `firestore:"lenderUsername" json:"lenderUsername"`
	ItemName         string    `firestore:"itemName" json:"itemName"`
	ItemCategory     string    `firestore:"itemCategory" json:"itemCategory"`
	UsageHeadline    string    `firestore:"usageHeadline" json:"usageHeadline"`
	UsageDescription string    `firestore:"usageDescription" json:"usageDescription"`
	ThankYouMessage  string    `firestore:"thankYouMessage" json:"thankYouMessage"`
	Photos           []string  `firestore:"photos" json:"photos"`
	Area             string    `firestore:"area" json:"area"`
	CreatedAt        time.Time `firestore:"createdAt" json:"createdAt"`
}

var idSeq uint32

func generateNumericID() int {
	seq := atomic.AddUint32(&idSeq, 1) % 1000
	base := (time.Now().Unix() % 2000000) * 1000
	return int(base) + int(seq)
}

func uploadImageToFirebaseStorage(ctx context.Context, folder string, entityID string, prefix string, dataURL string) (string, error) {
	return GetStorageProvider().SaveDataURL(ctx, dataURL, folder, entityID, prefix)
}

func uploadItemImageToFirebaseStorage(ctx context.Context, itemID string, dataURL string) (string, error) {
	return GetStorageProvider().SaveDataURL(ctx, dataURL, "items", itemID, "item")
}

func uploadProfileImageToFirebaseStorage(ctx context.Context, userID string, dataURL string) (string, error) {
	return GetStorageProvider().SaveDataURL(ctx, dataURL, "profiles", userID, "profile")
}

func uploadMomentImageToFirebaseStorage(ctx context.Context, momentID string, dataURL string, idx int) (string, error) {
	return GetStorageProvider().SaveDataURL(ctx, dataURL, "moments", momentID, fmt.Sprintf("moment-%d", idx))
}

func parseFlexibleTimestamp(raw interface{}) time.Time {
	if raw == nil {
		return time.Time{}
	}
	switch v := raw.(type) {
	case time.Time:
		return v
	case string:
		v = strings.TrimSpace(v)
		if v == "" {
			return time.Time{}
		}
		if t, err := time.Parse(time.RFC3339Nano, v); err == nil {
			return t
		}
		if t, err := time.Parse(time.RFC3339, v); err == nil {
			return t
		}
		if t, err := time.Parse("2006-01-02 15:04:05.999999999", v); err == nil {
			return t
		}
		if t, err := time.Parse("2006-01-02 15:04:05", v); err == nil {
			return t
		}
		if t, err := time.Parse("2006-01-02", v); err == nil {
			return t
		}
	case int64:
		if v > 1e11 {
			return time.UnixMilli(v).UTC()
		}
		return time.Unix(v, 0).UTC()
	case float64:
		iv := int64(v)
		if iv > 1e11 {
			return time.UnixMilli(iv).UTC()
		}
		return time.Unix(iv, 0).UTC()
	case int:
		iv := int64(v)
		if iv > 1e11 {
			return time.UnixMilli(iv).UTC()
		}
		return time.Unix(iv, 0).UTC()
	case map[string]interface{}:
		var secs int64
		if s, ok := v["seconds"].(int64); ok {
			secs = s
		} else if s, ok := v["_seconds"].(int64); ok {
			secs = s
		} else if s, ok := v["seconds"].(float64); ok {
			secs = int64(s)
		} else if s, ok := v["_seconds"].(float64); ok {
			secs = int64(s)
		}
		if secs > 0 {
			return time.Unix(secs, 0).UTC()
		}
	}
	return time.Time{}
}

func parseFirestoreUserDoc(doc *firestore.DocumentSnapshot) (*FirestoreUser, error) {
	if doc == nil || !doc.Exists() {
		return nil, errors.New("document does not exist")
	}
	var u FirestoreUser
	if err := doc.DataTo(&u); err == nil {
		if u.UserID == "" {
			u.UserID = doc.Ref.ID
		}
		return &u, nil
	}

	data := doc.Data()
	if data == nil {
		return nil, errors.New("empty document data")
	}

	u.UserID = doc.Ref.ID
	if val, ok := data["userId"].(string); ok && val != "" {
		u.UserID = val
	}
	if val, ok := data["id"].(int64); ok {
		u.ID = int(val)
	} else if val, ok := data["id"].(int); ok {
		u.ID = val
	} else if val, ok := data["id"].(float64); ok {
		u.ID = int(val)
	} else if u.UserID != "" {
		if idNum, err := strconv.Atoi(u.UserID); err == nil {
			u.ID = idNum
		}
	}
	if val, ok := data["username"].(string); ok {
		u.Username = val
	}
	if val, ok := data["email"].(string); ok {
		u.Email = val
	}
	if val, ok := data["fullName"].(string); ok {
		u.FullName = val
	}
	if val, ok := data["passwordHash"].(string); ok {
		u.PasswordHash = val
	}
	if val, ok := data["phone"].(string); ok {
		u.Phone = val
	}
	if val, ok := data["area"].(string); ok {
		u.Area = val
	}
	if val, ok := data["shelfName"].(string); ok {
		u.ShelfName = val
	}
	if val, ok := data["bio"].(string); ok {
		u.Bio = val
	}
	if val, ok := data["profileImage"].(string); ok {
		u.ProfileImage = val
	}
	if val, ok := data["locationSharingEnabled"].(bool); ok {
		u.LocationSharingEnabled = val
	}
	if val, ok := data["latitude"].(float64); ok {
		u.Latitude = val
	}
	if val, ok := data["longitude"].(float64); ok {
		u.Longitude = val
	}
	u.CreatedAt = parseFlexibleTimestamp(data["createdAt"])
	u.UpdatedAt = parseFlexibleTimestamp(data["updatedAt"])
	return &u, nil
}

func getFirestoreUser(ctx context.Context, identifier string) (*FirestoreUser, error) {
	if !IsFirebaseEnabled() {
		return nil, errors.New("firebase not enabled")
	}
	identifier = strings.TrimSpace(identifier)
	if identifier == "" {
		return nil, errors.New("empty identifier")
	}

	// 1. Direct doc lookup by doc ID (e.g. users/{userId})
	doc, err := GetFirestore().Collection("users").Doc(identifier).Get(ctx)
	if err == nil && doc.Exists() {
		u, err := parseFirestoreUserDoc(doc)
		if err == nil {
			return u, nil
		}
	}

	// 2. Query by username == identifier
	iter := GetFirestore().Collection("users").Where("username", "==", identifier).Limit(1).Documents(ctx)
	doc, err = iter.Next()
	iter.Stop()
	if err == nil && doc != nil && doc.Exists() {
		u, err := parseFirestoreUserDoc(doc)
		if err == nil {
			return u, nil
		}
	}

	// 3. Query by userId == identifier
	iter2 := GetFirestore().Collection("users").Where("userId", "==", identifier).Limit(1).Documents(ctx)
	doc2, err2 := iter2.Next()
	iter2.Stop()
	if err2 == nil && doc2 != nil && doc2.Exists() {
		u, err := parseFirestoreUserDoc(doc2)
		if err == nil {
			return u, nil
		}
	}

	return nil, errors.New("user not found in firestore")
}

func saveFirestoreUser(ctx context.Context, fUser FirestoreUser) error {
	if !IsFirebaseEnabled() {
		return errors.New("firebase not enabled")
	}
	docID := fUser.UserID
	if docID == "" && fUser.ID > 0 {
		docID = strconv.Itoa(fUser.ID)
		fUser.UserID = docID
	}
	if docID == "" {
		docID = fUser.Username
		fUser.UserID = docID
	}
	_, err := GetFirestore().Collection("users").Doc(docID).Set(ctx, fUser)
	return err
}

func syncUserToFirestore(ctx context.Context, username string) (*FirestoreUser, error) {
	if !IsFirebaseEnabled() || isSQLiteFallbackDisabled() || db == nil {
		return nil, errors.New("sqlite to firestore sync not applicable")
	}
	var u User
	var locSharing int
	var sqCreatedAt, sqUpdatedAt string
	err := db.QueryRow("SELECT id, username, COALESCE(email, ''), COALESCE(full_name, ''), password_hash, COALESCE(phone, ''), COALESCE(area, ''), COALESCE(shelf_name, ''), COALESCE(bio, ''), COALESCE(profile_image, ''), location_sharing_enabled, latitude, longitude, COALESCE(created_at, ''), COALESCE(updated_at, '') FROM users WHERE username = ?", username).
		Scan(&u.ID, &u.Username, &u.Email, &u.FullName, &u.PasswordHash, &u.Phone, &u.Area, &u.ShelfName, &u.Bio, &u.ProfileImage, &locSharing, &u.Latitude, &u.Longitude, &sqCreatedAt, &sqUpdatedAt)
	if err != nil {
		err = db.QueryRow("SELECT id, username, COALESCE(email, ''), COALESCE(full_name, ''), password_hash, COALESCE(phone, ''), COALESCE(area, ''), COALESCE(shelf_name, ''), COALESCE(bio, ''), COALESCE(profile_image, ''), location_sharing_enabled, latitude, longitude FROM users WHERE username = ?", username).
			Scan(&u.ID, &u.Username, &u.Email, &u.FullName, &u.PasswordHash, &u.Phone, &u.Area, &u.ShelfName, &u.Bio, &u.ProfileImage, &locSharing, &u.Latitude, &u.Longitude)
		if err != nil {
			return nil, err
		}
	}

	docID := strconv.Itoa(u.ID)
	createdAtTime := parseFlexibleTimestamp(sqCreatedAt)

	// DO NOT infer createdAt from items, lent items, or any other activity.
	// Only read genuine historical registration timestamp if already present in Firestore users/{userId}.
	if createdAtTime.IsZero() {
		existingDoc, err := GetFirestore().Collection("users").Doc(docID).Get(ctx)
		if err == nil && existingDoc.Exists() {
			if existingUser, err := parseFirestoreUserDoc(existingDoc); err == nil && existingUser != nil && !existingUser.CreatedAt.IsZero() {
				// Only use genuine account registration timestamp, never infer from items
				createdAtTime = existingUser.CreatedAt
			}
		}
	}

	now := time.Now().UTC()
	fUser := FirestoreUser{
		ID:                     u.ID,
		UserID:                 docID,
		Username:               u.Username,
		Email:                  u.Email,
		FullName:               u.FullName,
		PasswordHash:           u.PasswordHash,
		Phone:                  u.Phone,
		Area:                   u.Area,
		ShelfName:              u.ShelfName,
		Bio:                    u.Bio,
		ProfileImage:           u.ProfileImage,
		LocationSharingEnabled: locSharing == 1,
		Latitude:               u.Latitude,
		Longitude:              u.Longitude,
		CreatedAt:              createdAtTime,
		UpdatedAt:              now,
	}

	if err := saveFirestoreUser(ctx, fUser); err != nil {
		log.Printf("[Firestore] Failed to sync user %s to users/%s: %v", username, docID, err)
		return nil, err
	}
	return &fUser, nil
}

func persistItemImage(dataURL string) (string, error) {
	return GetStorageProvider().SaveDataURL(context.Background(), dataURL, "items", "general", "item")
}

type UpdateLocationRequest struct {
	LocationSharingEnabled bool    `json:"locationSharingEnabled"`
	Enabled                *bool   `json:"enabled,omitempty"`
	Latitude               float64 `json:"latitude"`
	Longitude              float64 `json:"longitude"`
}

type RadarItem struct {
	ID          interface{} `json:"id"`
	ItemName    string      `json:"itemName"`
	Category    string      `json:"category"`
	Description string      `json:"description"`
	Status      string      `json:"status"`
	CreatedAt   string      `json:"createdAt"`
	Owner       string      `json:"owner"`
	ShelfName   string      `json:"shelfName"`
	Phone       string      `json:"phone"`
	ImageUrl    string      `json:"imageUrl"`
	Latitude    float64     `json:"latitude"`
	Longitude   float64     `json:"longitude"`
	DistanceKM  float64     `json:"distanceKm"`
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
	ID               int     `json:"id"`
	ConversationID   int     `json:"conversationId"`
	SenderUsername   string  `json:"senderUsername"`
	ReceiverUsername string  `json:"receiverUsername,omitempty"`
	Content          string  `json:"content"`
	CreatedAt        string  `json:"createdAt"`
	ReadAt           *string `json:"readAt,omitempty"`
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
	if isSQLiteFallbackDisabled() && IsFirebaseEnabled() {
		log.Println("[Database] Production mode: Pure Firestore persistence active (DISABLE_SQLITE_FALLBACK=true). SQLite database initialization bypassed.")
		return
	}
	var err error
	db, err = sql.Open("sqlite3", "./mohalla.db")
	if err != nil {
		if isSQLiteFallbackDisabled() {
			log.Printf("[Database] Notice: SQLite open failed (%v), continuing with Firestore as primary.", err)
			return
		}
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
	db.Exec("ALTER TABLE users ADD COLUMN created_at TEXT DEFAULT ''")
	db.Exec("ALTER TABLE users ADD COLUMN updated_at TEXT DEFAULT ''")

	db.Exec("ALTER TABLE lent_items ADD COLUMN category TEXT DEFAULT 'Other'")
	db.Exec("ALTER TABLE lent_items ADD COLUMN description TEXT DEFAULT ''")
	db.Exec("ALTER TABLE lent_items ADD COLUMN lender_name TEXT DEFAULT ''")
	db.Exec("ALTER TABLE lent_items ADD COLUMN area TEXT DEFAULT ''")
	db.Exec("ALTER TABLE lent_items ADD COLUMN phone TEXT DEFAULT ''")
	db.Exec("ALTER TABLE lent_items ADD COLUMN duration TEXT DEFAULT '7 Days'")
	db.Exec("ALTER TABLE lent_items ADD COLUMN condition TEXT DEFAULT 'Good Working 👍'")
	db.Exec("ALTER TABLE lent_items ADD COLUMN image_url TEXT DEFAULT ''")
	db.Exec("ALTER TABLE lent_items ADD COLUMN created_at DATETIME DEFAULT '2026-08-13 12:00:00'")
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

	ctx := r.Context()
	if IsFirebaseEnabled() {
		existingUser, err := getFirestoreUser(ctx, req.Username)
		if err == nil && existingUser != nil {
			http.Error(w, "Username already exists", http.StatusConflict)
			return
		}
	}

	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	var userID int
	if IsFirebaseEnabled() && isSQLiteFallbackDisabled() {
		// Pure Firestore mode: No SQLite writes
		userID = generateNumericID()
		now := time.Now().UTC()
		fUser := FirestoreUser{
			ID:           userID,
			UserID:       strconv.Itoa(userID),
			Username:     req.Username,
			FullName:     "",
			ShelfName:    req.Username + "'s Shelf",
			PasswordHash: string(hashedPassword),
			CreatedAt:    now,
			UpdatedAt:    now,
		}
		if err := saveFirestoreUser(ctx, fUser); err != nil {
			log.Printf("[Firestore] Failed to save user %s to users/%s: %v", req.Username, fUser.UserID, err)
			http.Error(w, "Failed to create user in Firestore: "+err.Error(), http.StatusInternalServerError)
			return
		}
	} else {
		res, err := db.Exec("INSERT INTO users (username, password_hash) VALUES (?, ?)", req.Username, string(hashedPassword))
		if err != nil {
			if strings.Contains(err.Error(), "UNIQUE constraint failed") {
				http.Error(w, "Username already exists", http.StatusConflict)
				return
			}
			http.Error(w, "Internal server error", http.StatusInternalServerError)
			return
		}

		userID64, _ := res.LastInsertId()
		userID = int(userID64)

		// Persist user to Firestore users collection: users/{userId}
		if IsFirebaseEnabled() {
			now := time.Now().UTC()
			fUser := FirestoreUser{
				ID:           userID,
				UserID:       strconv.Itoa(userID),
				Username:     req.Username,
				FullName:     "",
				ShelfName:    req.Username + "'s Shelf",
				PasswordHash: string(hashedPassword),
				CreatedAt:    now,
				UpdatedAt:    now,
			}
			if err := saveFirestoreUser(ctx, fUser); err != nil {
				log.Printf("[Firestore] Failed to save user %s to users/%s: %v", req.Username, fUser.UserID, err)
			}
		}
	}

	tokenString, err := generateToken(userID, req.Username)
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

	req.Username = strings.TrimSpace(req.Username)
	if req.Username == "" || req.Password == "" {
		http.Error(w, "Invalid username or password", http.StatusUnauthorized)
		return
	}

	ctx := r.Context()
	var userID int
	var username, passwordHash string

	if IsFirebaseEnabled() {
		fUser, err := getFirestoreUser(ctx, req.Username)
		if err == nil && fUser != nil {
			userID = fUser.ID
			username = fUser.Username
			passwordHash = fUser.PasswordHash
		} else if !isSQLiteFallbackDisabled() && db != nil {
			// Auto-sync legacy user from SQLite into Firestore (only if SQLite fallback enabled)
			sUser, syncErr := syncUserToFirestore(ctx, req.Username)
			if syncErr == nil && sUser != nil {
				userID = sUser.ID
				username = sUser.Username
				passwordHash = sUser.PasswordHash
			}
		}
	} else if db != nil {
		var user User
		err := db.QueryRow("SELECT id, username, password_hash FROM users WHERE username = ?", req.Username).Scan(&user.ID, &user.Username, &user.PasswordHash)
		if err == nil {
			userID = user.ID
			username = user.Username
			passwordHash = user.PasswordHash
		}
	}

	if username == "" || passwordHash == "" {
		http.Error(w, "Invalid username or password", http.StatusUnauthorized)
		return
	}

	err := bcrypt.CompareHashAndPassword([]byte(passwordHash), []byte(req.Password))
	if err != nil {
		http.Error(w, "Invalid username or password", http.StatusUnauthorized)
		return
	}

	tokenString, err := generateToken(userID, username)
	if err != nil {
		http.Error(w, "Error generating JWT authentication token", http.StatusInternalServerError)
		return
	}

	json.NewEncoder(w).Encode(map[string]string{
		"token":    tokenString,
		"username": username,
	})
}

func profileHandler(w http.ResponseWriter, r *http.Request) {
	uCtx, ok := getUserFromContext(r)
	if !ok || uCtx.Username == "" {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}
	username := uCtx.Username
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	var email, fullName, phone, area, shelfName, bio, profileImage, createdAt, updatedAt string
	var locationSharingEnabled bool
	var latitude, longitude float64

	borrowed := []BorrowedItem{}
	lent := []LentItem{}
	listings := []LentItem{}
	var totalBorrowedCount, totalLentCount int

	if IsFirebaseEnabled() {
		var fUser *FirestoreUser
		if uCtx.UserID > 0 {
			fUser, _ = getFirestoreUser(ctx, strconv.Itoa(uCtx.UserID))
		}
		if fUser == nil {
			fUser, _ = getFirestoreUser(ctx, username)
		}
		if fUser == nil {
			fUser, _ = syncUserToFirestore(ctx, username)
		}

		if fUser != nil {
			email = fUser.Email
			fullName = fUser.FullName
			phone = fUser.Phone
			area = fUser.Area
			shelfName = fUser.ShelfName
			bio = fUser.Bio
			profileImage = fUser.ProfileImage
			locationSharingEnabled = fUser.LocationSharingEnabled
			latitude = fUser.Latitude
			longitude = fUser.Longitude
			// Do NOT use item.createdAt, listing.createdAt, or substitute dates.
			// For user 4 (Mahek09), the original account registration date was never recorded in SQLite (pre-migration)
			// and was previously substituted with the Camera creation date (2026-09-29T05:51:32Z).
			// If it matches that substitute date or is zero, do not report it as account registration date.
			if !fUser.CreatedAt.IsZero() && fUser.CreatedAt.Format(time.RFC3339) != "2026-09-29T05:51:32Z" {
				createdAt = fUser.CreatedAt.Format(time.RFC3339)
			}
			if !fUser.UpdatedAt.IsZero() {
				updatedAt = fUser.UpdatedAt.Format(time.RFC3339)
			}
		}

		var wg sync.WaitGroup
		var borrowedMu, lentMu, listingsMu sync.Mutex

		// 1. Real borrowed items from Firestore collection "borrowed_items"
		wg.Add(1)
		go func() {
			defer wg.Done()
			bIter := GetFirestore().Collection("borrowed_items").Where("username", "==", username).Documents(ctx)
			for {
				doc, err := bIter.Next()
				if err != nil {
					break
				}
				var b FirestoreBorrowedItem
				if err := doc.DataTo(&b); err == nil {
					borrowedMu.Lock()
					borrowed = append(borrowed, BorrowedItem{
						ID:       b.ID,
						Username: b.Username,
						ItemID:   b.ItemID,
						ItemName: b.ItemName,
						Lender:   b.Lender,
						DaysLeft: b.DaysLeft,
						Since:    b.Since,
						Note:     b.Note,
					})
					borrowedMu.Unlock()
				}
			}
			bIter.Stop()
		}()

		// 2. Real lent items from Firestore collection "lent_items"
		wg.Add(1)
		go func() {
			defer wg.Done()
			lIter := GetFirestore().Collection("lent_items").Where("username", "==", username).Documents(ctx)
			for {
				doc, err := lIter.Next()
				if err != nil {
					break
				}
				var l FirestoreLentItem
				if err := doc.DataTo(&l); err == nil {
					lentMu.Lock()
					lent = append(lent, LentItem{
						ID:          strconv.Itoa(l.ID),
						Username:    l.Username,
						ItemName:    l.ItemName,
						ItemNameAlt: l.ItemName,
						Status:      l.Status,
						Category:    l.Category,
						Description: l.Description,
						LenderName:  l.LenderName,
						Area:        l.Area,
						Phone:       l.Phone,
						Duration:    l.Duration,
						Condition:   l.Condition,
						ImageUrl:    l.ImageUrl,
						CreatedAt:   l.CreatedAt.Format(time.RFC3339),
					})
					lentMu.Unlock()
				}
			}
			lIter.Stop()
		}()

		// 3. Real active item listings from Firestore collection "items"
		wg.Add(1)
		go func() {
			defer wg.Done()
			itemIter := GetFirestore().Collection("items").Where("username", "==", username).Documents(ctx)
			for {
				doc, err := itemIter.Next()
				if err != nil {
					break
				}
				var fItem FirestoreItem
				if err := doc.DataTo(&fItem); err == nil {
					if fItem.ID == "" {
						fItem.ID = doc.Ref.ID
					}
					listingsMu.Lock()
					listings = append(listings, LentItem{
						ID:          fItem.ID,
						Username:    fItem.Username,
						ItemName:    fItem.ItemName,
						ItemNameAlt: fItem.ItemName,
						Status:      fItem.Status,
						Category:    fItem.Category,
						Description: fItem.Description,
						LenderName:  fItem.LenderName,
						Area:        fItem.Area,
						Phone:       fItem.Phone,
						Duration:    fItem.Duration,
						Condition:   fItem.Condition,
						ImageUrl:    fItem.ImageUrl,
						CreatedAt:   fItem.CreatedAt.Format(time.RFC3339),
					})
					listingsMu.Unlock()
				}
			}
			itemIter.Stop()
		}()

		wg.Wait()
		totalBorrowedCount = len(borrowed)

		// Active lending listings = real user's active Firestore listings
		displayLent := lent
		if len(displayLent) == 0 && len(listings) > 0 {
			displayLent = listings
		}
		totalLentCount = len(listings) + len(lent)
		lent = displayLent

	} else {
		// SQLite fallback
		var locSharingVal int
		var sqCreatedAt, sqUpdatedAt string
		_ = db.QueryRow("SELECT COALESCE(email, ''), COALESCE(full_name, ''), COALESCE(phone, ''), COALESCE(area, ''), COALESCE(shelf_name, ''), COALESCE(bio, ''), COALESCE(profile_image, ''), location_sharing_enabled, latitude, longitude, COALESCE(created_at, ''), COALESCE(updated_at, '') FROM users WHERE username = ?", username).
			Scan(&email, &fullName, &phone, &area, &shelfName, &bio, &profileImage, &locSharingVal, &latitude, &longitude, &sqCreatedAt, &sqUpdatedAt)
		locationSharingEnabled = locSharingVal == 1
		if sqCreatedAt != "" {
			t := parseFlexibleTimestamp(sqCreatedAt)
			if !t.IsZero() {
				createdAt = t.Format(time.RFC3339)
			} else {
				createdAt = sqCreatedAt
			}
		}
		if sqUpdatedAt != "" {
			t := parseFlexibleTimestamp(sqUpdatedAt)
			if !t.IsZero() {
				updatedAt = t.Format(time.RFC3339)
			} else {
				updatedAt = sqUpdatedAt
			}
		}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"username":               username,
		"email":                  email,
		"fullName":               fullName,
		"phone":                  phone,
		"area":                   area,
		"shelfName":              shelfName,
		"bio":                    bio,
		"profileImage":           profileImage,
		"locationSharingEnabled": locationSharingEnabled,
		"latitude":               latitude,
		"longitude":              longitude,
		"createdAt":              createdAt,
		"updatedAt":              updatedAt,
		"borrowed":               borrowed,
		"lent":                   lent,
		"listings":               listings,
		"totalBorrowedCount":     totalBorrowedCount,
		"totalLentCount":         totalLentCount,
		"activeItemsCount":       len(listings),
	})
}

func publicProfileHandler(w http.ResponseWriter, r *http.Request) {
	targetUser := strings.TrimSpace(r.URL.Query().Get("username"))
	if targetUser == "" {
		http.Error(w, "Username query parameter required", http.StatusBadRequest)
		return
	}

	ctx := r.Context()
	var fullName, area, shelfName, bio, profileImage, createdAt string
	lent := []LentItem{}

	if IsFirebaseEnabled() {
		fUser, err := getFirestoreUser(ctx, targetUser)
		if err != nil || fUser == nil {
			fUser, _ = syncUserToFirestore(ctx, targetUser)
		}

		if fUser != nil {
			fullName = fUser.FullName
			area = fUser.Area
			shelfName = fUser.ShelfName
			bio = fUser.Bio
			profileImage = fUser.ProfileImage
			if !fUser.CreatedAt.IsZero() {
				createdAt = fUser.CreatedAt.Format(time.RFC3339)
			}
		}

		if fullName == "" {
			fullName = targetUser
		}
		if shelfName == "" {
			shelfName = targetUser + "'s Shelf"
		}

		iter := GetFirestore().Collection("items").Where("username", "==", targetUser).Documents(ctx)
		for {
			doc, err := iter.Next()
			if err != nil {
				break
			}
			var fItem FirestoreItem
			if err := doc.DataTo(&fItem); err == nil {
				if fItem.ID == "" {
					fItem.ID = doc.Ref.ID
				}
				lent = append(lent, LentItem{
					ID:          fItem.ID,
					Username:    fItem.Username,
					ItemName:    fItem.ItemName,
					ItemNameAlt: fItem.ItemName,
					Status:      fItem.Status,
					Category:    fItem.Category,
					Description: fItem.Description,
					LenderName:  fItem.LenderName,
					Area:        fItem.Area,
					Phone:       fItem.Phone,
					Duration:    fItem.Duration,
					Condition:   fItem.Condition,
					ImageUrl:    fItem.ImageUrl,
					CreatedAt:   fItem.CreatedAt.Format(time.RFC3339),
				})
			}
		}
		iter.Stop()
	} else {
		var sqCreatedAt string
		_ = db.QueryRow(
			"SELECT COALESCE(NULLIF(full_name, ''), username), COALESCE(area, ''), COALESCE(NULLIF(shelf_name, ''), username || '''s Shelf'), COALESCE(bio, ''), COALESCE(profile_image, ''), COALESCE(created_at, '') FROM users WHERE username = ?",
			targetUser,
		).Scan(&fullName, &area, &shelfName, &bio, &profileImage, &sqCreatedAt)
		if sqCreatedAt != "" {
			t := parseFlexibleTimestamp(sqCreatedAt)
			if !t.IsZero() {
				createdAt = t.Format(time.RFC3339)
			} else {
				createdAt = sqCreatedAt
			}
		}
	}

	w.Header().Set("Content-Type", "application/json")
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

	ctx := r.Context()
	profileImageURL := req.ProfileImage
	if strings.HasPrefix(req.ProfileImage, "data:") {
		uploadedURL, err := GetStorageProvider().SaveDataURL(ctx, req.ProfileImage, "profiles", username, "profile")
		if err == nil && uploadedURL != "" {
			profileImageURL = uploadedURL
		} else {
			log.Printf("[Storage] Profile image upload error: %v", err)
		}
	}

	if IsFirebaseEnabled() {
		now := time.Now().UTC()
		fUser, err := getFirestoreUser(ctx, username)
		if err != nil || fUser == nil {
			fUser, _ = syncUserToFirestore(ctx, username)
		}

		if fUser != nil {
			fUser.FullName = req.FullName
			fUser.Email = req.Email
			fUser.Phone = req.Phone
			fUser.Area = req.Area
			fUser.ShelfName = req.ShelfName
			fUser.Bio = req.Bio
			if profileImageURL != "" {
				fUser.ProfileImage = profileImageURL
			}
			fUser.UpdatedAt = now
			_ = saveFirestoreUser(ctx, *fUser)
		}
	}

	// Also update SQLite for rollback safety only if SQLite fallback is enabled
	if !isSQLiteFallbackDisabled() && db != nil {
		_, _ = db.Exec(
			"UPDATE users SET full_name = ?, email = ?, phone = ?, area = ?, shelf_name = ?, bio = ?, profile_image = ?, updated_at = datetime('now') WHERE username = ?",
			req.FullName, req.Email, req.Phone, req.Area, req.ShelfName, req.Bio, profileImageURL, username,
		)
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"message":      "Profile updated successfully",
		"profileImage": profileImageURL,
	})
}

func borrowHandler(w http.ResponseWriter, r *http.Request) {
	createBorrowRequestHandler(w, r)
}

func lendHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	uCtx, ok := getUserFromContext(r)
	if !ok || uCtx == nil || uCtx.Username == "" {
		http.Error(w, "Unauthorized: Please log in to list an item", http.StatusUnauthorized)
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

	// Fetch user details from Firestore users (fallback to SQLite)
	var dbUserID int
	var fullName, userPhone, userArea, userShelf string
	var userLat, userLng float64
	var locSharing int
	if IsFirebaseEnabled() {
		fUser, err := getFirestoreUser(r.Context(), uCtx.Username)
		if err == nil && fUser != nil {
			dbUserID = fUser.ID
			fullName = fUser.FullName
			userPhone = fUser.Phone
			userArea = fUser.Area
			userShelf = fUser.ShelfName
			userLat = fUser.Latitude
			userLng = fUser.Longitude
			if fUser.LocationSharingEnabled {
				locSharing = 1
			}
		}
	}
	if dbUserID == 0 {
		_ = db.QueryRow(
			"SELECT id, full_name, phone, area, shelf_name, latitude, longitude, location_sharing_enabled FROM users WHERE username = ?",
			uCtx.Username,
		).Scan(&dbUserID, &fullName, &userPhone, &userArea, &userShelf, &userLat, &userLng, &locSharing)
	}

	lenderName := strings.TrimSpace(req.LenderName)
	if lenderName == "" {
		if fullName != "" {
			lenderName = fullName
		} else {
			lenderName = uCtx.Username
		}
	}

	category := strings.TrimSpace(req.Category)
	if category == "" {
		category = "Other"
	}

	area := strings.TrimSpace(req.Area)
	if area == "" {
		if userArea != "" {
			area = userArea
		} else {
			area = "Mohalla"
		}
	}

	phone := strings.TrimSpace(req.Phone)
	if phone == "" {
		phone = userPhone
	}

	duration := strings.TrimSpace(req.Duration)
	if duration == "" {
		duration = "7 Days"
	}

	condition := strings.TrimSpace(req.Condition)
	if condition == "" {
		condition = "Good Working 👍"
	}

	var itemLat, itemLng float64
	if locSharing == 1 && (userLat != 0 || userLng != 0) {
		itemLat = userLat
		itemLng = userLng
	}

	if IsFirebaseEnabled() {
		docRef := GetFirestore().Collection("items").NewDoc()
		itemID := docRef.ID

		var imageURL string
		var err error
		if strings.TrimSpace(req.ImageUrl) != "" {
			imageURL, err = GetStorageProvider().SaveDataURL(r.Context(), req.ImageUrl, "items", itemID, "item")
			if err != nil {
				log.Printf("[Storage] lend image persist error: %v", err)
				http.Error(w, "Could not save item photo: "+err.Error(), http.StatusInternalServerError)
				return
			}
		}

		now := time.Now().UTC()
		itemDoc := FirestoreItem{
			ID:           itemID,
			UserID:       strconv.Itoa(dbUserID),
			Username:     uCtx.Username,
			LenderName:   lenderName,
			ItemName:     req.ItemName,
			ItemNameAlt:  req.ItemName,
			Description:  req.Description,
			Category:     category,
			Condition:    condition,
			Availability: "Available Now",
			Status:       "active",
			Area:         area,
			Phone:        phone,
			Duration:     duration,
			Latitude:     itemLat,
			Longitude:    itemLng,
			ImageUrl:     imageURL,
			CreatedAt:    now,
			UpdatedAt:    now,
		}

		if _, err := docRef.Set(r.Context(), itemDoc); err != nil {
			log.Printf("[Firestore] Failed to save item %s: %v", itemID, err)
			http.Error(w, "Database error saving item to Firestore: "+err.Error(), http.StatusInternalServerError)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusCreated)
		json.NewEncoder(w).Encode(map[string]interface{}{
			"message": "Item put up for lending successfully",
			"id":      itemID,
			"item":    itemDoc,
		})
		return
	}

	// Legacy SQLite fallback if Firebase is disabled
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
		uCtx.Username, req.ItemName, "active", category, req.Description,
		lenderName, area, phone, duration, condition, imageURL,
	)
	if err != nil {
		http.Error(w, "Database error: "+err.Error(), http.StatusInternalServerError)
		return
	}

	insertedID, _ := res.LastInsertId()

	item := LentItem{
		ID:          int(insertedID),
		Username:    uCtx.Username,
		ItemName:    req.ItemName,
		ItemNameAlt: req.ItemName,
		Status:      "active",
		Category:    category,
		Description: req.Description,
		LenderName:  lenderName,
		Area:        area,
		Phone:       phone,
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

	if IsFirebaseEnabled() {
		ctx := r.Context()
		iter := GetFirestore().Collection("items").Documents(ctx)
		defer iter.Stop()

		items := []FirestoreItem{}
		for {
			doc, err := iter.Next()
			if err == iterator.Done {
				break
			}
			if err != nil {
				log.Printf("[Firestore] Error reading items: %v", err)
				http.Error(w, "Failed to read items from Firestore", http.StatusInternalServerError)
				return
			}

			var item FirestoreItem
			if err := doc.DataTo(&item); err != nil {
				log.Printf("[Firestore] Deserialization error for %s: %v", doc.Ref.ID, err)
				continue
			}
			if item.ID == "" {
				item.ID = doc.Ref.ID
			}
			if item.Status != "" && item.Status != "active" {
				continue
			}
			item.ItemNameAlt = item.ItemName
			items = append(items, item)
		}

		if len(items) == 0 {
			json.NewEncoder(w).Encode([]FirestoreItem{})
			return
		}

		sort.Slice(items, func(i, j int) bool {
			return items[i].CreatedAt.After(items[j].CreatedAt)
		})

		json.NewEncoder(w).Encode(items)
		return
	}

	// Legacy SQLite fallback
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

	items := []LentItem{}
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

func deleteItemHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodDelete && r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	uCtx, ok := getUserFromContext(r)
	if !ok || uCtx == nil || uCtx.Username == "" {
		http.Error(w, "Unauthorized: Please log in to delete an item", http.StatusUnauthorized)
		return
	}

	// Read item ID from query parameter or JSON body
	id := strings.TrimSpace(r.URL.Query().Get("id"))
	if id == "" {
		var req struct {
			ID string `json:"id"`
		}
		_ = json.NewDecoder(r.Body).Decode(&req)
		id = strings.TrimSpace(req.ID)
	}

	id = strings.TrimPrefix(id, "LEND-")
	id = strings.TrimPrefix(id, "lent_")
	id = strings.TrimSpace(id)

	if id == "" {
		http.Error(w, "Item ID is required", http.StatusBadRequest)
		return
	}

	ctx := r.Context()

	if IsFirebaseEnabled() {
		var itemDocRef *firestore.DocumentRef
		var itemUsername string
		var itemImageURL string

		docSnap, err := GetFirestore().Collection("items").Doc(id).Get(ctx)
		if err == nil && docSnap.Exists() {
			itemDocRef = docSnap.Ref
			var fItem FirestoreItem
			if docSnap.DataTo(&fItem) == nil {
				itemUsername = fItem.Username
				itemImageURL = fItem.ImageUrl
			}
		}

		if itemDocRef == nil {
			iter := GetFirestore().Collection("items").Where("id", "==", id).Limit(1).Documents(ctx)
			doc, err := iter.Next()
			iter.Stop()
			if err == nil && doc.Exists() {
				itemDocRef = doc.Ref
				var fItem FirestoreItem
				if doc.DataTo(&fItem) == nil {
					itemUsername = fItem.Username
					itemImageURL = fItem.ImageUrl
				}
			}
		}

		// Also check Firestore collection "lent_items"
		var lentDocRef *firestore.DocumentRef
		lentSnap, lErr := GetFirestore().Collection("lent_items").Doc(id).Get(ctx)
		if lErr == nil && lentSnap.Exists() {
			lentDocRef = lentSnap.Ref
			var fLent FirestoreLentItem
			if lentSnap.DataTo(&fLent) == nil && itemUsername == "" {
				itemUsername = fLent.Username
			}
		}
		if lentDocRef == nil {
			if intId, parseErr := strconv.Atoi(id); parseErr == nil {
				iter := GetFirestore().Collection("lent_items").Where("id", "==", intId).Limit(1).Documents(ctx)
				doc, err := iter.Next()
				iter.Stop()
				if err == nil && doc.Exists() {
					lentDocRef = doc.Ref
					var fLent FirestoreLentItem
					if doc.DataTo(&fLent) == nil && itemUsername == "" {
						itemUsername = fLent.Username
					}
				}
			}
		}

		if itemDocRef == nil && lentDocRef == nil {
			// Check legacy SQLite before returning not found
			var sqlUsername string
			sqlErr := db.QueryRow("SELECT username FROM lent_items WHERE id = ? OR item_name = ?", id, id).Scan(&sqlUsername)
			if sqlErr != nil {
				http.Error(w, "Item not found", http.StatusNotFound)
				return
			}
			if !strings.EqualFold(sqlUsername, uCtx.Username) {
				http.Error(w, "Forbidden: Cannot delete item lent by another user", http.StatusForbidden)
				return
			}
			_, _ = db.Exec("DELETE FROM lent_items WHERE (id = ? OR item_name = ?) AND username = ?", id, id, uCtx.Username)
			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(map[string]interface{}{
				"message": "Item deleted successfully",
				"id":      id,
			})
			return
		}

		// Ownership check
		if itemUsername != "" && !strings.EqualFold(itemUsername, uCtx.Username) {
			http.Error(w, "Forbidden: Cannot delete item lent by another user", http.StatusForbidden)
			return
		}

		if itemDocRef != nil {
			if _, err := itemDocRef.Delete(ctx); err != nil {
				log.Printf("[Firestore] Error deleting item doc %s: %v", id, err)
			}
		}

		if lentDocRef != nil {
			if _, err := lentDocRef.Delete(ctx); err != nil {
				log.Printf("[Firestore] Error deleting lent_item doc %s: %v", id, err)
			}
		}

		if itemImageURL != "" {
			_ = GetStorageProvider().Delete(ctx, itemImageURL)
		}

		// Clean up pending borrow requests for this deleted item
		brIter := GetFirestore().Collection("borrow_requests").Where("itemId", "==", id).Documents(ctx)
		for {
			brDoc, err := brIter.Next()
			if err != nil {
				break
			}
			_, _ = brDoc.Ref.Delete(ctx)
		}
		brIter.Stop()

		// Also clean up SQLite in case of dual-writes
		_, _ = db.Exec("DELETE FROM lent_items WHERE (id = ? OR item_name = ?) AND username = ?", id, id, uCtx.Username)

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{
			"message": "Item deleted successfully",
			"id":      id,
		})
		return
	}

	// SQLite only mode
	var sqlUsername string
	err := db.QueryRow("SELECT username FROM lent_items WHERE id = ? OR item_name = ?", id, id).Scan(&sqlUsername)
	if err != nil {
		http.Error(w, "Item not found", http.StatusNotFound)
		return
	}

	if !strings.EqualFold(sqlUsername, uCtx.Username) {
		http.Error(w, "Forbidden: Cannot delete item lent by another user", http.StatusForbidden)
		return
	}

	_, err = db.Exec("DELETE FROM lent_items WHERE (id = ? OR item_name = ?) AND username = ?", id, id, uCtx.Username)
	if err != nil {
		http.Error(w, "Failed to delete item: "+err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"message": "Item deleted successfully",
		"id":      id,
	})
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

	ctx := r.Context()
	if req.Enabled != nil {
		req.LocationSharingEnabled = *req.Enabled
	}
	locVal := 0
	if req.LocationSharingEnabled {
		locVal = 1
	}

	if IsFirebaseEnabled() {
		fUser, err := getFirestoreUser(ctx, username)
		if err != nil || fUser == nil {
			fUser, _ = syncUserToFirestore(ctx, username)
		}
		if fUser != nil {
			now := time.Now().UTC()
			fUser.LocationSharingEnabled = req.LocationSharingEnabled
			fUser.Latitude = req.Latitude
			fUser.Longitude = req.Longitude
			fUser.UpdatedAt = now
			_ = saveFirestoreUser(ctx, *fUser)
		}
	}

	if !isSQLiteFallbackDisabled() && db != nil {
		_, _ = db.Exec("UPDATE users SET location_sharing_enabled = ?, latitude = ?, longitude = ?, updated_at = datetime('now') WHERE username = ?", locVal, req.Latitude, req.Longitude, username)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"message":                "Location settings updated",
		"locationSharingEnabled": req.LocationSharingEnabled,
		"latitude":               req.Latitude,
		"longitude":              req.Longitude,
	})
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
	// Return exact coordinate without artificial offset shifts
	return val
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

	radius := 50.0
	if radiusStr != "" {
		if strings.EqualFold(radiusStr, "all") || radiusStr == "0" {
			radius = 500.0
		} else {
			rVal, err := strconv.ParseFloat(radiusStr, 64)
			if err == nil && rVal > 0 {
				radius = rVal
			}
		}
	}

	if IsFirebaseEnabled() {
		ctx := r.Context()
		iter := GetFirestore().Collection("items").Documents(ctx)
		defer iter.Stop()

		list := []RadarItem{}
		for {
			doc, err := iter.Next()
			if err == iterator.Done {
				break
			}
			if err != nil {
				log.Printf("[Firestore] Radar items read error: %v", err)
				break
			}

			var item FirestoreItem
			if err := doc.DataTo(&item); err != nil {
				continue
			}
			if item.ID == "" {
				item.ID = doc.Ref.ID
			}
			if item.Status != "" && item.Status != "active" {
				continue
			}

			var ownerLat, ownerLng float64
			var shelfName, ownerPhone string

			if item.Latitude != 0 || item.Longitude != 0 {
				ownerLat = item.Latitude
				ownerLng = item.Longitude
			}

			// Lookup user details from Firestore users (fallback to SQLite)
			var locSharingEnabled bool
			var uLat, uLng float64
			fUser, err := getFirestoreUser(ctx, item.Username)
			if err == nil && fUser != nil {
				shelfName = fUser.ShelfName
				ownerPhone = fUser.Phone
				locSharingEnabled = fUser.LocationSharingEnabled
				uLat = fUser.Latitude
				uLng = fUser.Longitude
			} else if !isSQLiteFallbackDisabled() && db != nil {
				var locSharingInt int
				_ = db.QueryRow(
					"SELECT shelf_name, phone, latitude, longitude, location_sharing_enabled FROM users WHERE username = ?",
					item.Username,
				).Scan(&shelfName, &ownerPhone, &uLat, &uLng, &locSharingInt)
				locSharingEnabled = locSharingInt == 1
			}

			if !locSharingEnabled {
				// User turned off location sharing; do not display on radar
				continue
			}

			if ownerLat == 0 && ownerLng == 0 && (uLat != 0 || uLng != 0) {
				ownerLat = uLat
				ownerLng = uLng
			}

			// If still no coordinates, do NOT invent coordinates!
			if ownerLat == 0 && ownerLng == 0 {
				continue
			}

			if shelfName == "" {
				shelfName = item.LenderName
			}
			if ownerPhone == "" {
				ownerPhone = item.Phone
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

			list = append(list, RadarItem{
				ID:          item.ID,
				ItemName:    item.ItemName,
				Category:    item.Category,
				Description: item.Description,
				Status:      item.Status,
				CreatedAt:   item.CreatedAt.Format("2006-01-02 15:04:05"),
				Owner:       item.LenderName,
				ShelfName:   shelfName,
				Phone:       ownerPhone,
				ImageUrl:    item.ImageUrl,
				Latitude:    deterministicFuzz(ownerLat, item.Username),
				Longitude:   deterministicFuzz(ownerLng, item.Username),
				DistanceKM:  dist,
			})
		}

		if len(list) == 0 {
			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode([]RadarItem{})
			return
		}

		if strings.EqualFold(sortVal, "recent") {
			sort.Slice(list, func(i, j int) bool {
				return list[i].CreatedAt > list[j].CreatedAt
			})
		} else {
			sort.Slice(list, func(i, j int) bool {
				return list[i].DistanceKM < list[j].DistanceKM
			})
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(list)
		return
	}

	// Legacy SQLite fallback
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
	list := []RadarItem{}
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
				if fmt.Sprintf("%v", list[i].ID) < fmt.Sprintf("%v", list[j].ID) {
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

	if req.ItemID == "" && req.ItemName == "" {
		http.Error(w, "itemId or itemName is required", http.StatusBadRequest)
		return
	}

	ctx := r.Context()
	numID := generateNumericID()

	if IsFirebaseEnabled() {
		// 1. Validate that the requested item actually exists in Firestore items collection
		var fItem *FirestoreItem
		if req.ItemID != "" {
			itemDoc, err := GetFirestore().Collection("items").Doc(req.ItemID).Get(ctx)
			if err == nil && itemDoc.Exists() {
				var it FirestoreItem
				if itemDoc.DataTo(&it) == nil {
					fItem = &it
					if fItem.ID == "" {
						fItem.ID = itemDoc.Ref.ID
					}
				}
			}

			if fItem == nil {
				iter := GetFirestore().Collection("items").Where("id", "==", req.ItemID).Limit(1).Documents(ctx)
				doc, err := iter.Next()
				iter.Stop()
				if err == nil && doc.Exists() {
					var it FirestoreItem
					if doc.DataTo(&it) == nil {
						fItem = &it
						if fItem.ID == "" {
							fItem.ID = doc.Ref.ID
						}
					}
				}
			}
		}

		if fItem == nil && req.ItemName != "" {
			iter := GetFirestore().Collection("items").Where("itemName", "==", req.ItemName).Limit(1).Documents(ctx)
			doc, err := iter.Next()
			iter.Stop()
			if err == nil && doc.Exists() {
				var it FirestoreItem
				if doc.DataTo(&it) == nil {
					fItem = &it
					if fItem.ID == "" {
						fItem.ID = doc.Ref.ID
					}
				}
			}
		}

		if fItem == nil {
			http.Error(w, "Item not found in store", http.StatusNotFound)
			return
		}

		// 2. Lender and Item Name come strictly from the actual Firestore item document
		realLender := fItem.Username
		if realLender == "" {
			realLender = fItem.LenderName
		}
		realItemName := fItem.ItemName
		req.ItemID = fItem.ID

		// 3. Prevent a user from requesting their own item
		if strings.EqualFold(realLender, uCtx.Username) || (fItem.UserID != "" && fItem.UserID == strconv.Itoa(uCtx.UserID)) {
			http.Error(w, "You cannot borrow your own item", http.StatusBadRequest)
			return
		}

		// 4. Check if request is already pending or accepted
		q := GetFirestore().Collection("borrow_requests").
			Where("borrowerUsername", "==", uCtx.Username).
			Where("itemId", "==", req.ItemID)
		iter := q.Documents(ctx)
		for {
			doc, err := iter.Next()
			if err != nil {
				break
			}
			var existing FirestoreBorrowRequest
			if err := doc.DataTo(&existing); err == nil {
				if existing.Status == "pending" || existing.Status == "accepted" {
					iter.Stop()
					http.Error(w, "A borrow request for this item is already pending or accepted", http.StatusConflict)
					return
				}
			}
		}
		iter.Stop()

		// 5. Create real borrow request in borrow_requests/{requestId}
		now := time.Now().UTC()
		docID := strconv.Itoa(numID)
		docRef := GetFirestore().Collection("borrow_requests").Doc(docID)
		fReq := FirestoreBorrowRequest{
			ID:               numID,
			DocID:            docID,
			ItemID:           req.ItemID,
			ItemName:         realItemName,
			BorrowerUsername: uCtx.Username,
			LenderUsername:   realLender,
			Status:           "pending",
			Note:             req.Note,
			CreatedAt:        now,
			UpdatedAt:        now,
		}
		if _, err := docRef.Set(ctx, fReq); err != nil {
			log.Printf("[Firestore] Failed to create borrow request: %v", err)
			http.Error(w, "Failed to save borrow request to Firestore: "+err.Error(), http.StatusInternalServerError)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusCreated)
		json.NewEncoder(w).Encode(map[string]interface{}{
			"message": "Borrow request sent successfully",
			"id":      numID,
			"status":  "pending",
			"item":    realItemName,
			"lender":  realLender,
		})
		return
	} else {
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
		numID = int(lastID)
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"message": "Borrow request sent successfully",
		"id":      numID,
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

	ctx := r.Context()
	list := []BorrowRequestRecord{}

	if IsFirebaseEnabled() {
		convMap := make(map[int]int)
		cIter := GetFirestore().Collection("conversations").
			Where("borrowerUsername", "==", uCtx.Username).Documents(ctx)
		for {
			doc, err := cIter.Next()
			if err != nil {
				break
			}
			var c FirestoreConversation
			if err := doc.DataTo(&c); err == nil && c.BorrowRequestID > 0 {
				convMap[c.BorrowRequestID] = c.ID
			}
		}
		cIter.Stop()

		cLenderIter := GetFirestore().Collection("conversations").
			Where("lenderUsername", "==", uCtx.Username).Documents(ctx)
		for {
			doc, err := cLenderIter.Next()
			if err != nil {
				break
			}
			var c FirestoreConversation
			if err := doc.DataTo(&c); err == nil && c.BorrowRequestID > 0 {
				convMap[c.BorrowRequestID] = c.ID
			}
		}
		cLenderIter.Stop()

		seen := make(map[int]bool)

		bIter := GetFirestore().Collection("borrow_requests").
			Where("borrowerUsername", "==", uCtx.Username).Documents(ctx)
		for {
			doc, err := bIter.Next()
			if err != nil {
				break
			}
			var fReq FirestoreBorrowRequest
			if err := doc.DataTo(&fReq); err == nil {
				if seen[fReq.ID] {
					continue
				}
				seen[fReq.ID] = true
				rec := BorrowRequestRecord{
					ID:               fReq.ID,
					ItemID:           fReq.ItemID,
					ItemName:         fReq.ItemName,
					BorrowerUsername: fReq.BorrowerUsername,
					LenderUsername:   fReq.LenderUsername,
					Status:           fReq.Status,
					Note:             fReq.Note,
					CreatedAt:        fReq.CreatedAt.Format("2006-01-02 15:04:05"),
					UpdatedAt:        fReq.UpdatedAt.Format("2006-01-02 15:04:05"),
				}
				if convID, exists := convMap[fReq.ID]; exists {
					rec.ConversationID = &convID
				}
				list = append(list, rec)
			}
		}
		bIter.Stop()

		lIter := GetFirestore().Collection("borrow_requests").
			Where("lenderUsername", "==", uCtx.Username).Documents(ctx)
		for {
			doc, err := lIter.Next()
			if err != nil {
				break
			}
			var fReq FirestoreBorrowRequest
			if err := doc.DataTo(&fReq); err == nil {
				if seen[fReq.ID] {
					continue
				}
				seen[fReq.ID] = true
				rec := BorrowRequestRecord{
					ID:               fReq.ID,
					ItemID:           fReq.ItemID,
					ItemName:         fReq.ItemName,
					BorrowerUsername: fReq.BorrowerUsername,
					LenderUsername:   fReq.LenderUsername,
					Status:           fReq.Status,
					Note:             fReq.Note,
					CreatedAt:        fReq.CreatedAt.Format("2006-01-02 15:04:05"),
					UpdatedAt:        fReq.UpdatedAt.Format("2006-01-02 15:04:05"),
				}
				if convID, exists := convMap[fReq.ID]; exists {
					rec.ConversationID = &convID
				}
				list = append(list, rec)
			}
		}
		lIter.Stop()

		sort.Slice(list, func(i, j int) bool {
			return list[i].ID > list[j].ID
		})

	} else {
		rows, err := db.Query(`
			SELECT
				br.id, br.item_id, br.item_name, br.borrower_username, br.lender_username, br.status, br.note, br.created_at, br.updated_at,
				c.id
			FROM borrow_requests br
			LEFT JOIN conversations c ON br.id = c.borrow_request_id
			WHERE br.borrower_username = ? OR br.lender_username = ?
			ORDER BY br.id DESC
		`, uCtx.Username, uCtx.Username)
		if err == nil {
			defer rows.Close()
			for rows.Next() {
				var rec BorrowRequestRecord
				var convID sql.NullInt64
				err = rows.Scan(&rec.ID, &rec.ItemID, &rec.ItemName, &rec.BorrowerUsername, &rec.LenderUsername, &rec.Status, &rec.Note, &rec.CreatedAt, &rec.UpdatedAt, &convID)
				if err == nil {
					if convID.Valid {
						cID := int(convID.Int64)
						rec.ConversationID = &cID
					}
					list = append(list, rec)
				}
			}
		}
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

	ctx := r.Context()
	var convID int

	if IsFirebaseEnabled() {
		var docRef *firestore.DocumentRef
		var fReq FirestoreBorrowRequest

		doc, err := GetFirestore().Collection("borrow_requests").Doc(strconv.Itoa(req.RequestID)).Get(ctx)
		if err == nil && doc.Exists() {
			if doc.DataTo(&fReq) == nil {
				docRef = doc.Ref
			}
		}

		if docRef == nil {
			iter := GetFirestore().Collection("borrow_requests").Where("id", "==", req.RequestID).Limit(1).Documents(ctx)
			doc, err := iter.Next()
			iter.Stop()
			if err == nil && doc.Exists() {
				if doc.DataTo(&fReq) == nil {
					docRef = doc.Ref
				}
			}
		}

		if docRef == nil {
			http.Error(w, "Borrow request not found", http.StatusNotFound)
			return
		}

		if !strings.EqualFold(fReq.LenderUsername, uCtx.Username) {
			http.Error(w, "Forbidden: Only the lender can accept this borrow request", http.StatusForbidden)
			return
		}

		if fReq.Status != "pending" {
			http.Error(w, "Borrow request is not pending", http.StatusBadRequest)
			return
		}

		now := time.Now().UTC()

		// Update borrow request status to accepted
		_, err = docRef.Update(ctx, []firestore.Update{
			{Path: "status", Value: "accepted"},
			{Path: "updatedAt", Value: now},
		})
		if err != nil {
			http.Error(w, "Failed to update borrow request: "+err.Error(), http.StatusInternalServerError)
			return
		}

		// Insert into Firestore borrowed_items
		borrowedDocRef := GetFirestore().Collection("borrowed_items").NewDoc()
		borrowedItemDoc := FirestoreBorrowedItem{
			ID:              generateNumericID(),
			DocID:           borrowedDocRef.ID,
			Username:        fReq.BorrowerUsername,
			ItemID:          fReq.ItemID,
			ItemName:        fReq.ItemName,
			Lender:          fReq.LenderUsername,
			DaysLeft:        3,
			Since:           "Just accepted",
			Note:            "Accepted via Mohalla Store",
			BorrowRequestID: fReq.ID,
			CreatedAt:       now,
		}
		_, _ = borrowedDocRef.Set(ctx, borrowedItemDoc)

		// Create or find conversation in Firestore conversations
		convIter := GetFirestore().Collection("conversations").Where("borrowRequestId", "==", fReq.ID).Limit(1).Documents(ctx)
		cDoc, cErr := convIter.Next()
		convIter.Stop()

		if cErr == nil {
			var existingConv FirestoreConversation
			if cDoc.DataTo(&existingConv) == nil {
				convID = existingConv.ID
			}
		}

		if convID == 0 {
			convID = generateNumericID()
			convDocID := strconv.Itoa(convID)
			cDocRef := GetFirestore().Collection("conversations").Doc(convDocID)
			newConv := FirestoreConversation{
				ID:               convID,
				DocID:            convDocID,
				BorrowRequestID:  fReq.ID,
				BorrowerUsername: fReq.BorrowerUsername,
				LenderUsername:   fReq.LenderUsername,
				ItemID:           fReq.ItemID,
				ItemName:         fReq.ItemName,
				LastMessage:      "",
				LastMessageTime:  "",
				CreatedAt:        now,
				UpdatedAt:        now,
			}
			_, _ = cDocRef.Set(ctx, newConv)
		}

		// Update conversationId on borrow_requests doc
		_, _ = docRef.Update(ctx, []firestore.Update{
			{Path: "conversationId", Value: convID},
		})

	} else {
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

		_, _ = db.Exec("UPDATE borrow_requests SET status = 'accepted', updated_at = datetime('now') WHERE id = ?", req.RequestID)
		res, err := db.Exec(
			"INSERT INTO conversations (borrow_request_id, borrower_username, lender_username, item_id, item_name, created_at, updated_at) VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now'))",
			req.RequestID, borrowerUsername, lenderUsername, itemID, itemName,
		)
		if err == nil {
			cID, _ := res.LastInsertId()
			convID = int(cID)
		} else {
			_ = db.QueryRow("SELECT id FROM conversations WHERE borrow_request_id = ?", req.RequestID).Scan(&convID)
		}
		_, _ = db.Exec(
			"INSERT INTO borrowed_items (username, item_id, item_name, lender, days_left, since, note) VALUES (?, ?, ?, ?, 3, 'Just accepted', 'Accepted via Mohalla Store')",
			borrowerUsername, itemID, itemName, lenderUsername,
		)
	}

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

	ctx := r.Context()
	if IsFirebaseEnabled() {
		var docRef *firestore.DocumentRef
		var fReq FirestoreBorrowRequest

		doc, err := GetFirestore().Collection("borrow_requests").Doc(strconv.Itoa(req.RequestID)).Get(ctx)
		if err == nil && doc.Exists() {
			if doc.DataTo(&fReq) == nil {
				docRef = doc.Ref
			}
		}

		if docRef == nil {
			iter := GetFirestore().Collection("borrow_requests").Where("id", "==", req.RequestID).Limit(1).Documents(ctx)
			doc, err := iter.Next()
			iter.Stop()
			if err == nil && doc.Exists() {
				if doc.DataTo(&fReq) == nil {
					docRef = doc.Ref
				}
			}
		}

		if docRef == nil {
			http.Error(w, "Borrow request not found", http.StatusNotFound)
			return
		}

		if !strings.EqualFold(fReq.LenderUsername, uCtx.Username) {
			http.Error(w, "Forbidden: Only the lender can reject this borrow request", http.StatusForbidden)
			return
		}

		if fReq.Status != "pending" {
			http.Error(w, "Borrow request is not pending", http.StatusBadRequest)
			return
		}

		now := time.Now().UTC()
		_, err = docRef.Update(ctx, []firestore.Update{
			{Path: "status", Value: "rejected"},
			{Path: "updatedAt", Value: now},
		})
		if err != nil {
			http.Error(w, "Failed to update borrow request: "+err.Error(), http.StatusInternalServerError)
			return
		}
	} else {
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

		_, _ = db.Exec("UPDATE borrow_requests SET status = 'rejected', updated_at = datetime('now') WHERE id = ?", req.RequestID)
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

	ctx := r.Context()
	list := []ConversationRecord{}

	if IsFirebaseEnabled() {
		seen := make(map[int]bool)

		// 1. Where borrowerUsername == uCtx.Username
		bIter := GetFirestore().Collection("conversations").Where("borrowerUsername", "==", uCtx.Username).Documents(ctx)
		for {
			doc, err := bIter.Next()
			if err != nil {
				break
			}
			var fc FirestoreConversation
			if err := doc.DataTo(&fc); err == nil && !seen[fc.ID] {
				seen[fc.ID] = true
				rec := ConversationRecord{
					ID:               fc.ID,
					BorrowRequestID:  fc.BorrowRequestID,
					BorrowerUsername: fc.BorrowerUsername,
					LenderUsername:   fc.LenderUsername,
					ItemID:           fc.ItemID,
					ItemName:         fc.ItemName,
					OtherUser:        fc.LenderUsername,
					LastMessage:      fc.LastMessage,
					LastMessageTime:  fc.LastMessageTime,
					CreatedAt:        fc.CreatedAt.Format("2006-01-02 15:04:05"),
					UpdatedAt:        fc.UpdatedAt.Format("2006-01-02 15:04:05"),
				}
				list = append(list, rec)
			}
		}
		bIter.Stop()

		// 2. Where lenderUsername == uCtx.Username
		lIter := GetFirestore().Collection("conversations").Where("lenderUsername", "==", uCtx.Username).Documents(ctx)
		for {
			doc, err := lIter.Next()
			if err != nil {
				break
			}
			var fc FirestoreConversation
			if err := doc.DataTo(&fc); err == nil && !seen[fc.ID] {
				seen[fc.ID] = true
				rec := ConversationRecord{
					ID:               fc.ID,
					BorrowRequestID:  fc.BorrowRequestID,
					BorrowerUsername: fc.BorrowerUsername,
					LenderUsername:   fc.LenderUsername,
					ItemID:           fc.ItemID,
					ItemName:         fc.ItemName,
					OtherUser:        fc.BorrowerUsername,
					LastMessage:      fc.LastMessage,
					LastMessageTime:  fc.LastMessageTime,
					CreatedAt:        fc.CreatedAt.Format("2006-01-02 15:04:05"),
					UpdatedAt:        fc.UpdatedAt.Format("2006-01-02 15:04:05"),
				}
				list = append(list, rec)
			}
		}
		lIter.Stop()

		// For each conversation, compute unread count and latest message
		for i := range list {
			convDocID := strconv.Itoa(list[i].ID)
			mIter := GetFirestore().Collection("conversations").Doc(convDocID).Collection("messages").Documents(ctx)
			unread := 0
			var latestTime time.Time
			var latestContent string
			mCount := 0
			for {
				mDoc, mErr := mIter.Next()
				if mErr != nil {
					break
				}
				var fm FirestoreMessage
				if mDoc.DataTo(&fm) == nil {
					mCount++
					if fm.CreatedAt.After(latestTime) {
						latestTime = fm.CreatedAt
						latestContent = fm.Content
					}
					if !strings.EqualFold(fm.SenderUsername, uCtx.Username) && fm.ReadAt == nil {
						unread++
					}
				}
			}
			mIter.Stop()

			if mCount == 0 {
				mIterTop := GetFirestore().Collection("messages").Where("conversationId", "==", list[i].ID).Documents(ctx)
				for {
					mDoc, mErr := mIterTop.Next()
					if mErr != nil {
						break
					}
					var fm FirestoreMessage
					if mDoc.DataTo(&fm) == nil {
						if fm.CreatedAt.After(latestTime) {
							latestTime = fm.CreatedAt
							latestContent = fm.Content
						}
						if !strings.EqualFold(fm.SenderUsername, uCtx.Username) && fm.ReadAt == nil {
							unread++
						}
					}
				}
				mIterTop.Stop()
			}

			list[i].UnreadCount = unread
			if latestContent != "" {
				list[i].LastMessage = latestContent
				list[i].LastMessageTime = latestTime.Format("2006-01-02 15:04:05")
			}
		}

		sort.Slice(list, func(i, j int) bool {
			return list[i].UpdatedAt > list[j].UpdatedAt
		})
	} else {
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

	ctx := r.Context()
	msgs := []MessageRecord{}

	if IsFirebaseEnabled() {
		// Verify authorization: check by Doc(convIDStr) or Where("id", "==", convID)
		var cDocRef *firestore.DocumentRef
		var fc FirestoreConversation

		docSnap, err := GetFirestore().Collection("conversations").Doc(convIDStr).Get(ctx)
		if err == nil && docSnap.Exists() {
			if docSnap.DataTo(&fc) == nil {
				cDocRef = docSnap.Ref
			}
		}

		if cDocRef == nil {
			cIter := GetFirestore().Collection("conversations").Where("id", "==", convID).Limit(1).Documents(ctx)
			doc, cErr := cIter.Next()
			cIter.Stop()
			if cErr == nil && doc.Exists() {
				if doc.DataTo(&fc) == nil {
					cDocRef = doc.Ref
				}
			}
		}

		if cDocRef == nil {
			http.Error(w, "Conversation not found", http.StatusNotFound)
			return
		}

		if !strings.EqualFold(fc.BorrowerUsername, uCtx.Username) && !strings.EqualFold(fc.LenderUsername, uCtx.Username) {
			http.Error(w, "Forbidden: You are not a participant in this conversation", http.StatusForbidden)
			return
		}

		now := time.Now().UTC()
		seenMsg := make(map[int]bool)

		// 1. Fetch from subcollection: conversations/{convID}/messages
		subIter := cDocRef.Collection("messages").Documents(ctx)
		for {
			mDoc, mErr := subIter.Next()
			if mErr != nil {
				break
			}
			var fm FirestoreMessage
			if mDoc.DataTo(&fm) == nil {
				if seenMsg[fm.ID] {
					continue
				}
				seenMsg[fm.ID] = true
				if fm.ReceiverUsername == "" {
					if strings.EqualFold(fm.SenderUsername, fc.BorrowerUsername) {
						fm.ReceiverUsername = fc.LenderUsername
					} else {
						fm.ReceiverUsername = fc.BorrowerUsername
					}
				}
				if !strings.EqualFold(fm.SenderUsername, uCtx.Username) && fm.ReadAt == nil {
					_, _ = mDoc.Ref.Update(ctx, []firestore.Update{
						{Path: "readAt", Value: now},
					})
					rTime := now.Format("2006-01-02 15:04:05")
					msgs = append(msgs, MessageRecord{
						ID:               fm.ID,
						ConversationID:   fm.ConversationID,
						SenderUsername:   fm.SenderUsername,
						ReceiverUsername: fm.ReceiverUsername,
						Content:          fm.Content,
						CreatedAt:        fm.CreatedAt.Format("2006-01-02 15:04:05"),
						ReadAt:           &rTime,
					})
				} else {
					var rTime *string
					if fm.ReadAt != nil {
						s := fm.ReadAt.Format("2006-01-02 15:04:05")
						rTime = &s
					}
					msgs = append(msgs, MessageRecord{
						ID:               fm.ID,
						ConversationID:   fm.ConversationID,
						SenderUsername:   fm.SenderUsername,
						ReceiverUsername: fm.ReceiverUsername,
						Content:          fm.Content,
						CreatedAt:        fm.CreatedAt.Format("2006-01-02 15:04:05"),
						ReadAt:           rTime,
					})
				}
			}
		}
		subIter.Stop()

		// 2. Also check top-level messages collection if subcollection was empty
		if len(msgs) == 0 {
			topIter := GetFirestore().Collection("messages").Where("conversationId", "==", convID).Documents(ctx)
			for {
				mDoc, mErr := topIter.Next()
				if mErr != nil {
					break
				}
				var fm FirestoreMessage
				if mDoc.DataTo(&fm) == nil {
					if seenMsg[fm.ID] {
						continue
					}
					seenMsg[fm.ID] = true
					if fm.ReceiverUsername == "" {
						if strings.EqualFold(fm.SenderUsername, fc.BorrowerUsername) {
							fm.ReceiverUsername = fc.LenderUsername
						} else {
							fm.ReceiverUsername = fc.BorrowerUsername
						}
					}
					if !strings.EqualFold(fm.SenderUsername, uCtx.Username) && fm.ReadAt == nil {
						_, _ = mDoc.Ref.Update(ctx, []firestore.Update{
							{Path: "readAt", Value: now},
						})
						rTime := now.Format("2006-01-02 15:04:05")
						msgs = append(msgs, MessageRecord{
							ID:               fm.ID,
							ConversationID:   fm.ConversationID,
							SenderUsername:   fm.SenderUsername,
							ReceiverUsername: fm.ReceiverUsername,
							Content:          fm.Content,
							CreatedAt:        fm.CreatedAt.Format("2006-01-02 15:04:05"),
							ReadAt:           &rTime,
						})
					} else {
						var rTime *string
						if fm.ReadAt != nil {
							s := fm.ReadAt.Format("2006-01-02 15:04:05")
							rTime = &s
						}
						msgs = append(msgs, MessageRecord{
							ID:               fm.ID,
							ConversationID:   fm.ConversationID,
							SenderUsername:   fm.SenderUsername,
							ReceiverUsername: fm.ReceiverUsername,
							Content:          fm.Content,
							CreatedAt:        fm.CreatedAt.Format("2006-01-02 15:04:05"),
							ReadAt:           rTime,
						})
					}
				}
			}
			topIter.Stop()
		}

		sort.Slice(msgs, func(i, j int) bool {
			return msgs[i].ID < msgs[j].ID
		})
	} else {
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

	ctx := r.Context()
	var msgRecord MessageRecord

	if IsFirebaseEnabled() {
		convIDStr := strconv.Itoa(input.ConversationID)
		var cDocRef *firestore.DocumentRef
		var fc FirestoreConversation

		docSnap, err := GetFirestore().Collection("conversations").Doc(convIDStr).Get(ctx)
		if err == nil && docSnap.Exists() {
			if docSnap.DataTo(&fc) == nil {
				cDocRef = docSnap.Ref
			}
		}

		if cDocRef == nil {
			cIter := GetFirestore().Collection("conversations").Where("id", "==", input.ConversationID).Limit(1).Documents(ctx)
			doc, cErr := cIter.Next()
			cIter.Stop()
			if cErr == nil && doc.Exists() {
				if doc.DataTo(&fc) == nil {
					cDocRef = doc.Ref
				}
			}
		}

		if cDocRef == nil {
			http.Error(w, "Forbidden: You are not a participant in this conversation", http.StatusForbidden)
			return
		}

		if !strings.EqualFold(fc.BorrowerUsername, uCtx.Username) && !strings.EqualFold(fc.LenderUsername, uCtx.Username) {
			http.Error(w, "Forbidden: You are not a participant in this conversation", http.StatusForbidden)
			return
		}

		var receiverUsername string
		if strings.EqualFold(uCtx.Username, fc.BorrowerUsername) {
			receiverUsername = fc.LenderUsername
		} else {
			receiverUsername = fc.BorrowerUsername
		}

		now := time.Now().UTC()
		msgID := generateNumericID()
		msgDocID := strconv.Itoa(msgID)

		fMsg := FirestoreMessage{
			ID:               msgID,
			DocID:            msgDocID,
			ConversationID:   input.ConversationID,
			SenderUsername:   uCtx.Username,
			ReceiverUsername: receiverUsername,
			Content:          input.Content,
			CreatedAt:        now,
		}

		// 1. Save in subcollection: conversations/{convID}/messages/{msgID}
		_, err = cDocRef.Collection("messages").Doc(msgDocID).Set(ctx, fMsg)
		if err != nil {
			http.Error(w, "Failed to save message: "+err.Error(), http.StatusInternalServerError)
			return
		}

		// 2. Also save in top-level messages collection for indexing: messages/{msgID}
		_, _ = GetFirestore().Collection("messages").Doc(msgDocID).Set(ctx, fMsg)

		// 3. Update conversation lastMessage, lastMessageTime, updatedAt
		_, _ = cDocRef.Update(ctx, []firestore.Update{
			{Path: "lastMessage", Value: input.Content},
			{Path: "lastMessageTime", Value: now.Format("2006-01-02 15:04:05")},
			{Path: "updatedAt", Value: now},
		})

		msgRecord = MessageRecord{
			ID:               msgID,
			ConversationID:   input.ConversationID,
			SenderUsername:   uCtx.Username,
			ReceiverUsername: receiverUsername,
			Content:          input.Content,
			CreatedAt:        now.Format("2006-01-02 15:04:05"),
		}
	} else {
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

		msgRecord = MessageRecord{
			ID:             int(msgID),
			ConversationID: input.ConversationID,
			SenderUsername: uCtx.Username,
			Content:        input.Content,
			CreatedAt:      createdAt,
		}
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
	var fc FirestoreConversation
	var cDocRef *firestore.DocumentRef
	if IsFirebaseEnabled() {
		convIDStr := strconv.Itoa(convID)
		docSnap, err := GetFirestore().Collection("conversations").Doc(convIDStr).Get(r.Context())
		if err == nil && docSnap.Exists() {
			if docSnap.DataTo(&fc) == nil {
				cDocRef = docSnap.Ref
			}
		}
		if cDocRef == nil {
			cIter := GetFirestore().Collection("conversations").Where("id", "==", convID).Limit(1).Documents(r.Context())
			doc, cErr := cIter.Next()
			cIter.Stop()
			if cErr == nil && doc.Exists() {
				if doc.DataTo(&fc) == nil {
					cDocRef = doc.Ref
				}
			}
		}
		if cDocRef == nil || (!strings.EqualFold(fc.BorrowerUsername, claims.Username) && !strings.EqualFold(fc.LenderUsername, claims.Username)) {
			http.Error(w, "Forbidden: Not a participant", http.StatusForbidden)
			return
		}
	} else {
		var count int
		err = db.QueryRow("SELECT COUNT(*) FROM conversations WHERE id = ? AND (borrower_username = ? OR lender_username = ?)", convID, claims.Username, claims.Username).Scan(&count)
		if err != nil || count == 0 {
			http.Error(w, "Forbidden: Not a participant", http.StatusForbidden)
			return
		}
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

		var msgRecord MessageRecord
		if IsFirebaseEnabled() {
			var receiverUsername string
			if strings.EqualFold(claims.Username, fc.BorrowerUsername) {
				receiverUsername = fc.LenderUsername
			} else {
				receiverUsername = fc.BorrowerUsername
			}

			now := time.Now().UTC()
			msgID := generateNumericID()
			msgDocID := strconv.Itoa(msgID)

			fMsg := FirestoreMessage{
				ID:               msgID,
				DocID:            msgDocID,
				ConversationID:   convID,
				SenderUsername:   claims.Username,
				ReceiverUsername: receiverUsername,
				Content:          content,
				CreatedAt:        now,
			}

			if cDocRef != nil {
				_, _ = cDocRef.Collection("messages").Doc(msgDocID).Set(context.Background(), fMsg)
				_, _ = cDocRef.Update(context.Background(), []firestore.Update{
					{Path: "lastMessage", Value: content},
					{Path: "lastMessageTime", Value: now.Format("2006-01-02 15:04:05")},
					{Path: "updatedAt", Value: now},
				})
			}
			_, _ = GetFirestore().Collection("messages").Doc(msgDocID).Set(context.Background(), fMsg)

			msgRecord = MessageRecord{
				ID:               msgID,
				ConversationID:   convID,
				SenderUsername:   claims.Username,
				ReceiverUsername: receiverUsername,
				Content:          content,
				CreatedAt:        now.Format("2006-01-02 15:04:05"),
			}
		} else {
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

			msgRecord = MessageRecord{
				ID:             int(msgID),
				ConversationID: convID,
				SenderUsername: claims.Username,
				Content:        content,
				CreatedAt:      createdAt,
			}
		}

		hub.broadcast <- BroadcastMessage{
			ConversationID: convID,
			Message:        msgRecord,
		}
	}
}

func getRecommendationsHandler(w http.ResponseWriter, r *http.Request) {
	category := strings.TrimSpace(r.URL.Query().Get("category"))
	search := strings.TrimSpace(r.URL.Query().Get("search"))

	ctx := r.Context()
	posts := []RecommendationPost{}

	if IsFirebaseEnabled() {
		iter := GetFirestore().Collection("recommendation_posts").Documents(ctx)
		defer iter.Stop()

		for {
			doc, err := iter.Next()
			if err != nil {
				break
			}
			var fPost FirestoreRecommendationPost
			if err := doc.DataTo(&fPost); err != nil {
				continue
			}

			// Filter category
			if category != "" && strings.ToLower(category) != "all" {
				if !strings.EqualFold(fPost.Category, category) {
					continue
				}
			}

			// Filter search
			if search != "" {
				sLower := strings.ToLower(search)
				match := strings.Contains(strings.ToLower(fPost.Title), sLower) ||
					strings.Contains(strings.ToLower(fPost.Description), sLower) ||
					strings.Contains(strings.ToLower(fPost.Category), sLower)
				if !match {
					continue
				}
			}

			p := RecommendationPost{
				ID:          fPost.ID,
				UserID:      fPost.UserID,
				Username:    fPost.Username,
				Title:       fPost.Title,
				Description: fPost.Description,
				Category:    fPost.Category,
				Area:        fPost.Area,
				CreatedAt:   fPost.CreatedAt.Format("2006-01-02 15:04:05"),
				UpdatedAt:   fPost.UpdatedAt.Format("2006-01-02 15:04:05"),
			}

			// Fetch replies count and neighbours
			neighbourSet := map[string]bool{fPost.Username: true}
			repIter := GetFirestore().Collection("recommendation_replies").Where("postId", "==", fPost.ID).Documents(ctx)
			repCount := 0
			for {
				rDoc, rErr := repIter.Next()
				if rErr != nil {
					break
				}
				var fr FirestoreRecommendationReply
				if rDoc.DataTo(&fr) == nil {
					repCount++
					neighbourSet[fr.Username] = true
				}
			}
			repIter.Stop()
			p.RepliesCount = repCount
			p.NeighbourCount = len(neighbourSet)

			// Fetch structured recommendations
			recIter := GetFirestore().Collection("recommendations").Where("postId", "==", fPost.ID).Documents(ctx)
			recs := []StructuredRecommendation{}
			for {
				rcDoc, rcErr := recIter.Next()
				if rcErr != nil {
					break
				}
				var fRec FirestoreStructuredRecommendation
				if rcDoc.DataTo(&fRec) == nil {
					// Count endorsements
					eIter := GetFirestore().Collection("recommendation_endorsements").Where("recommendationId", "==", fRec.ID).Documents(ctx)
					eCount := 0
					for {
						if _, eErr := eIter.Next(); eErr != nil {
							break
						}
						eCount++
					}
					eIter.Stop()

					recs = append(recs, StructuredRecommendation{
						ID:               fRec.ID,
						PostID:           fRec.PostID,
						ReplyID:          fRec.ReplyID,
						Name:             fRec.Name,
						Category:         fRec.Category,
						Description:      fRec.Description,
						Location:         fRec.Location,
						CreatedBy:        fRec.CreatedBy,
						CreatedAt:        fRec.CreatedAt.Format("2006-01-02 15:04:05"),
						RecommendedCount: eCount + 1,
					})
				}
			}
			recIter.Stop()
			p.Recommendations = recs

			posts = append(posts, p)
		}

		sort.Slice(posts, func(i, j int) bool {
			return posts[i].ID > posts[j].ID
		})
	} else {
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
	}

	w.Header().Set("Content-Type", "application/json")
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

	ctx := r.Context()
	var p RecommendationPost

	if IsFirebaseEnabled() {
		var fPost FirestoreRecommendationPost
		var pDocRef *firestore.DocumentRef

		docSnap, err := GetFirestore().Collection("recommendation_posts").Doc(strconv.Itoa(id)).Get(ctx)
		if err == nil && docSnap.Exists() {
			if docSnap.DataTo(&fPost) == nil {
				pDocRef = docSnap.Ref
			}
		}

		if pDocRef == nil {
			pIter := GetFirestore().Collection("recommendation_posts").Where("id", "==", id).Limit(1).Documents(ctx)
			pDoc, pErr := pIter.Next()
			pIter.Stop()
			if pErr == nil && pDoc.Exists() {
				if pDoc.DataTo(&fPost) == nil {
					pDocRef = pDoc.Ref
				}
			}
		}

		if pDocRef == nil {
			http.Error(w, "Post not found", http.StatusNotFound)
			return
		}

		p = RecommendationPost{
			ID:          fPost.ID,
			UserID:      fPost.UserID,
			Username:    fPost.Username,
			Title:       fPost.Title,
			Description: fPost.Description,
			Category:    fPost.Category,
			Area:        fPost.Area,
			CreatedAt:   fPost.CreatedAt.Format("2006-01-02 15:04:05"),
			UpdatedAt:   fPost.UpdatedAt.Format("2006-01-02 15:04:05"),
		}

		neighbourSet := map[string]bool{fPost.Username: true}
		replies := []RecommendationReply{}

		rIter := GetFirestore().Collection("recommendation_replies").Where("postId", "==", id).Documents(ctx)
		for {
			rDoc, rErr := rIter.Next()
			if rErr != nil {
				break
			}
			var fRep FirestoreRecommendationReply
			if rDoc.DataTo(&fRep) == nil {
				neighbourSet[fRep.Username] = true
				rep := RecommendationReply{
					ID:        fRep.ID,
					PostID:    fRep.PostID,
					Username:  fRep.Username,
					Content:   fRep.Content,
					CreatedAt: fRep.CreatedAt.Format("2006-01-02 15:04:05"),
				}

				// Count helpful votes
				vIter := GetFirestore().Collection("recommendation_helpful_votes").Where("replyId", "==", fRep.ID).Documents(ctx)
				vCount := 0
				hasVoted := false
				for {
					vDoc, vErr := vIter.Next()
					if vErr != nil {
						break
					}
					vCount++
					var voteData struct {
						Username string `firestore:"username"`
					}
					if vDoc.DataTo(&voteData) == nil && currentUsername != "" && strings.EqualFold(voteData.Username, currentUsername) {
						hasVoted = true
					}
				}
				vIter.Stop()
				rep.HelpfulCount = vCount
				rep.HasVotedHelpful = hasVoted

				// Structured recommendation attached to reply
				rcIter := GetFirestore().Collection("recommendations").Where("replyId", "==", fRep.ID).Limit(1).Documents(ctx)
				if rcDoc, rcErr := rcIter.Next(); rcErr == nil {
					var fRec FirestoreStructuredRecommendation
					if rcDoc.DataTo(&fRec) == nil {
						// Endorsements
						eIter := GetFirestore().Collection("recommendation_endorsements").Where("recommendationId", "==", fRec.ID).Documents(ctx)
						eCount := 0
						hasEndorsed := false
						for {
							eDoc, eErr := eIter.Next()
							if eErr != nil {
								break
							}
							eCount++
							var eData struct {
								Username string `firestore:"username"`
							}
							if eDoc.DataTo(&eData) == nil && currentUsername != "" && strings.EqualFold(eData.Username, currentUsername) {
								hasEndorsed = true
							}
						}
						eIter.Stop()

						rep.Recommendation = &StructuredRecommendation{
							ID:               fRec.ID,
							PostID:           fRec.PostID,
							ReplyID:          fRec.ReplyID,
							Name:             fRec.Name,
							Category:         fRec.Category,
							Description:      fRec.Description,
							Location:         fRec.Location,
							CreatedBy:        fRec.CreatedBy,
							CreatedAt:        fRec.CreatedAt.Format("2006-01-02 15:04:05"),
							RecommendedCount: eCount + 1,
							HasEndorsed:      hasEndorsed,
						}
					}
				}
				rcIter.Stop()

				replies = append(replies, rep)
			}
		}
		rIter.Stop()

		sort.Slice(replies, func(i, j int) bool {
			return replies[i].ID < replies[j].ID
		})

		p.Replies = replies
		p.RepliesCount = len(replies)
		p.NeighbourCount = len(neighbourSet)

		// All recommendations for post
		postRecs := []StructuredRecommendation{}
		prIter := GetFirestore().Collection("recommendations").Where("postId", "==", id).Documents(ctx)
		for {
			prDoc, prErr := prIter.Next()
			if prErr != nil {
				break
			}
			var fRec FirestoreStructuredRecommendation
			if prDoc.DataTo(&fRec) == nil {
				eIter := GetFirestore().Collection("recommendation_endorsements").Where("recommendationId", "==", fRec.ID).Documents(ctx)
				eCount := 0
				hasEndorsed := false
				for {
					eDoc, eErr := eIter.Next()
					if eErr != nil {
						break
					}
					eCount++
					var eData struct {
						Username string `firestore:"username"`
					}
					if eDoc.DataTo(&eData) == nil && currentUsername != "" && strings.EqualFold(eData.Username, currentUsername) {
						hasEndorsed = true
					}
				}
				eIter.Stop()

				postRecs = append(postRecs, StructuredRecommendation{
					ID:               fRec.ID,
					PostID:           fRec.PostID,
					ReplyID:          fRec.ReplyID,
					Name:             fRec.Name,
					Category:         fRec.Category,
					Description:      fRec.Description,
					Location:         fRec.Location,
					CreatedBy:        fRec.CreatedBy,
					CreatedAt:        fRec.CreatedAt.Format("2006-01-02 15:04:05"),
					RecommendedCount: eCount + 1,
					HasEndorsed:      hasEndorsed,
				})
			}
		}
		prIter.Stop()
		p.Recommendations = postRecs

	} else {
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
	}

	w.Header().Set("Content-Type", "application/json")
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

	var postID int

	if IsFirebaseEnabled() {
		ctx := r.Context()
		now := time.Now().UTC()
		postID = generateNumericID()
		docIDStr := strconv.Itoa(postID)
		docRef := GetFirestore().Collection("recommendation_posts").Doc(docIDStr)
		fPost := FirestoreRecommendationPost{
			ID:          postID,
			DocID:       docIDStr,
			UserID:      uCtx.UserID,
			Username:    uCtx.Username,
			Title:       req.Title,
			Description: req.Description,
			Category:    req.Category,
			Area:        req.Area,
			CreatedAt:   now,
			UpdatedAt:   now,
		}
		if _, err := docRef.Set(ctx, fPost); err != nil {
			http.Error(w, "Failed to save recommendation post: "+err.Error(), http.StatusInternalServerError)
			return
		}
	} else {
		res, err := db.Exec(
			"INSERT INTO recommendation_posts (user_id, username, title, description, category, area, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))",
			uCtx.UserID, uCtx.Username, req.Title, req.Description, req.Category, req.Area,
		)
		if err != nil {
			http.Error(w, "Database error: "+err.Error(), http.StatusInternalServerError)
			return
		}
		pID, _ := res.LastInsertId()
		postID = int(pID)
	}

	w.WriteHeader(http.StatusCreated)
	w.Header().Set("Content-Type", "application/json")
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

	ctx := r.Context()

	if IsFirebaseEnabled() {
		var fPost FirestoreRecommendationPost
		var pDocRef *firestore.DocumentRef

		docSnap, err := GetFirestore().Collection("recommendation_posts").Doc(strconv.Itoa(id)).Get(ctx)
		if err == nil && docSnap.Exists() {
			if docSnap.DataTo(&fPost) == nil {
				pDocRef = docSnap.Ref
			}
		}

		if pDocRef == nil {
			pIter := GetFirestore().Collection("recommendation_posts").Where("id", "==", id).Limit(1).Documents(ctx)
			pDoc, pErr := pIter.Next()
			pIter.Stop()
			if pErr == nil && pDoc.Exists() {
				if pDoc.DataTo(&fPost) == nil {
					pDocRef = pDoc.Ref
				}
			}
		}

		if pDocRef == nil {
			http.Error(w, "Post not found", http.StatusNotFound)
			return
		}

		if !strings.EqualFold(fPost.Username, uCtx.Username) {
			http.Error(w, "Forbidden: Cannot delete post created by another user", http.StatusForbidden)
			return
		}

		_, _ = pDocRef.Delete(ctx)

		// Clean up replies
		rIter := GetFirestore().Collection("recommendation_replies").Where("postId", "==", id).Documents(ctx)
		for {
			rd, re := rIter.Next()
			if re != nil {
				break
			}
			_, _ = rd.Ref.Delete(ctx)
		}
		rIter.Stop()

		// Clean up recommendations
		rcIter := GetFirestore().Collection("recommendations").Where("postId", "==", id).Documents(ctx)
		for {
			rcd, rce := rcIter.Next()
			if rce != nil {
				break
			}
			_, _ = rcd.Ref.Delete(ctx)
		}
		rcIter.Stop()
	} else {
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
	}

	w.WriteHeader(http.StatusOK)
	w.Header().Set("Content-Type", "application/json")
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

	ctx := r.Context()
	var replyID int

	if IsFirebaseEnabled() {
		// Verify post exists
		pIter := GetFirestore().Collection("recommendation_posts").Where("id", "==", req.PostID).Limit(1).Documents(ctx)
		_, pErr := pIter.Next()
		pIter.Stop()
		if pErr != nil {
			http.Error(w, "Post not found", http.StatusNotFound)
			return
		}

		now := time.Now().UTC()
		replyID = generateNumericID()
		replyDocID := strconv.Itoa(replyID)
		rDocRef := GetFirestore().Collection("recommendation_replies").Doc(replyDocID)
		fReply := FirestoreRecommendationReply{
			ID:             replyID,
			DocID:          replyDocID,
			PostID:         req.PostID,
			Username:       uCtx.Username,
			Content:        req.Content,
			RecName:        req.RecName,
			RecCategory:    req.RecCategory,
			RecDescription: req.RecDescription,
			RecLocation:    req.RecLocation,
			CreatedAt:      now,
		}
		if _, err := rDocRef.Set(ctx, fReply); err != nil {
			http.Error(w, "Failed to save reply: "+err.Error(), http.StatusInternalServerError)
			return
		}

		req.RecName = strings.TrimSpace(req.RecName)
		if req.RecName != "" {
			if req.RecLocation == "" {
				req.RecLocation = "Near you"
			}
			recID := generateNumericID()
			recDocID := strconv.Itoa(recID)
			recDocRef := GetFirestore().Collection("recommendations").Doc(recDocID)
			fRec := FirestoreStructuredRecommendation{
				ID:          recID,
				DocID:       recDocID,
				PostID:      req.PostID,
				ReplyID:     replyID,
				Name:        req.RecName,
				Category:    strings.TrimSpace(req.RecCategory),
				Description: strings.TrimSpace(req.RecDescription),
				Location:    strings.TrimSpace(req.RecLocation),
				CreatedBy:   uCtx.Username,
				CreatedAt:   now,
			}
			_, _ = recDocRef.Set(ctx, fRec)
		}
	} else {
		res, err := db.Exec(
			"INSERT INTO recommendation_replies (post_id, username, content, created_at) VALUES (?, ?, ?, datetime('now'))",
			req.PostID, uCtx.Username, req.Content,
		)
		if err != nil {
			http.Error(w, "Database error: "+err.Error(), http.StatusInternalServerError)
			return
		}
		rID, _ := res.LastInsertId()
		replyID = int(rID)

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
	}

	w.WriteHeader(http.StatusCreated)
	w.Header().Set("Content-Type", "application/json")
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

	ctx := r.Context()
	hasVoted := false
	newCount := 0

	if IsFirebaseEnabled() {
		voteDocID := fmt.Sprintf("%d_%s", req.ReplyID, uCtx.Username)
		voteDocRef := GetFirestore().Collection("recommendation_helpful_votes").Doc(voteDocID)
		docSnap, err := voteDocRef.Get(ctx)
		if err == nil && docSnap.Exists() {
			_, _ = voteDocRef.Delete(ctx)
			hasVoted = false
		} else {
			_, _ = voteDocRef.Set(ctx, map[string]interface{}{
				"replyId":   req.ReplyID,
				"username":  uCtx.Username,
				"createdAt": time.Now().UTC(),
			})
			hasVoted = true
		}

		vIter := GetFirestore().Collection("recommendation_helpful_votes").Where("replyId", "==", req.ReplyID).Documents(ctx)
		for {
			if _, vErr := vIter.Next(); vErr != nil {
				break
			}
			newCount++
		}
		vIter.Stop()
	} else {
		var count int
		db.QueryRow("SELECT COUNT(*) FROM recommendation_helpful_votes WHERE reply_id = ? AND username = ?", req.ReplyID, uCtx.Username).Scan(&count)

		if count > 0 {
			db.Exec("DELETE FROM recommendation_helpful_votes WHERE reply_id = ? AND username = ?", req.ReplyID, uCtx.Username)
		} else {
			db.Exec("INSERT INTO recommendation_helpful_votes (reply_id, username) VALUES (?, ?)", req.ReplyID, uCtx.Username)
			hasVoted = true
		}

		db.QueryRow("SELECT COUNT(*) FROM recommendation_helpful_votes WHERE reply_id = ?", req.ReplyID).Scan(&newCount)
	}

	w.Header().Set("Content-Type", "application/json")
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

	ctx := r.Context()
	hasEndorsed := false
	addEndorsements := 0

	if IsFirebaseEnabled() {
		endorseDocID := fmt.Sprintf("%d_%s", req.RecommendationID, uCtx.Username)
		docRef := GetFirestore().Collection("recommendation_endorsements").Doc(endorseDocID)
		docSnap, err := docRef.Get(ctx)
		if err == nil && docSnap.Exists() {
			_, _ = docRef.Delete(ctx)
			hasEndorsed = false
		} else {
			_, _ = docRef.Set(ctx, map[string]interface{}{
				"recommendationId": req.RecommendationID,
				"username":         uCtx.Username,
				"createdAt":        time.Now().UTC(),
			})
			hasEndorsed = true
		}

		eIter := GetFirestore().Collection("recommendation_endorsements").Where("recommendationId", "==", req.RecommendationID).Documents(ctx)
		for {
			if _, eErr := eIter.Next(); eErr != nil {
				break
			}
			addEndorsements++
		}
		eIter.Stop()
	} else {
		var count int
		db.QueryRow("SELECT COUNT(*) FROM recommendation_endorsements WHERE recommendation_id = ? AND username = ?", req.RecommendationID, uCtx.Username).Scan(&count)

		if count > 0 {
			db.Exec("DELETE FROM recommendation_endorsements WHERE recommendation_id = ? AND username = ?", req.RecommendationID, uCtx.Username)
		} else {
			db.Exec("INSERT INTO recommendation_endorsements (recommendation_id, username) VALUES (?, ?)", req.RecommendationID, uCtx.Username)
			hasEndorsed = true
		}

		db.QueryRow("SELECT COUNT(*) FROM recommendation_endorsements WHERE recommendation_id = ?", req.RecommendationID).Scan(&addEndorsements)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"recommendedCount": addEndorsements + 1,
		"hasEndorsed":      hasEndorsed,
	})
}

func getMohallaMomentsHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	ctx := r.Context()
	moments := []MohallaMoment{}
	totalBorrowed := 0

	if IsFirebaseEnabled() {
		iter := GetFirestore().Collection("moments").Documents(ctx)
		defer iter.Stop()

		for {
			doc, err := iter.Next()
			if err != nil {
				break
			}
			var fm FirestoreMohallaMoment
			if err := doc.DataTo(&fm); err == nil {
				if fm.Photos == nil {
					fm.Photos = []string{}
				}
				moments = append(moments, MohallaMoment{
					ID:               fm.ID,
					BorrowRequestID:  fm.BorrowRequestID,
					BorrowerUsername: fm.BorrowerUsername,
					LenderUsername:   fm.LenderUsername,
					ItemName:         fm.ItemName,
					ItemCategory:     fm.ItemCategory,
					UsageHeadline:    fm.UsageHeadline,
					UsageDescription: fm.UsageDescription,
					ThankYouMessage:  fm.ThankYouMessage,
					Photos:           fm.Photos,
					Area:             fm.Area,
					CreatedAt:        fm.CreatedAt.Format("2006-01-02 15:04:05"),
				})
			}
		}

		sort.Slice(moments, func(i, j int) bool {
			return moments[i].CreatedAt > moments[j].CreatedAt
		})

		// Count accepted borrow requests in Firestore
		brIter := GetFirestore().Collection("borrow_requests").Where("status", "==", "accepted").Documents(ctx)
		for {
			if _, brErr := brIter.Next(); brErr != nil {
				break
			}
			totalBorrowed++
		}
		brIter.Stop()

		if len(moments) > totalBorrowed {
			totalBorrowed = len(moments)
		}
	} else {
		rows, err := db.Query(`SELECT id, borrow_request_id, borrower_username, lender_username, item_name, item_category, usage_headline, usage_description, thank_you_message, photos, area, created_at FROM mohalla_moments ORDER BY created_at DESC`)
		if err != nil {
			log.Printf("Error querying mohalla_moments: %v", err)
			http.Error(w, "Failed to query moments", http.StatusInternalServerError)
			return
		}
		defer rows.Close()

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

		db.QueryRow(`SELECT COUNT(*) FROM borrow_requests WHERE status = 'accepted'`).Scan(&totalBorrowed)
		if len(moments) > totalBorrowed {
			totalBorrowed = len(moments)
		}
	}

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

	input.UsageHeadline = strings.TrimSpace(input.UsageHeadline)
	input.UsageDescription = strings.TrimSpace(input.UsageDescription)
	input.ThankYouMessage = strings.TrimSpace(input.ThankYouMessage)
	input.ItemCategory = strings.TrimSpace(input.ItemCategory)
	input.Area = strings.TrimSpace(input.Area)

	if input.UsageHeadline == "" || input.UsageDescription == "" {
		http.Error(w, "Usage headline and description are required", http.StatusBadRequest)
		return
	}

	ctx := r.Context()
	var realLender, realItem, status string
	var realReqID int

	if IsFirebaseEnabled() {
		if input.BorrowRequestID > 0 {
			iter := GetFirestore().Collection("borrow_requests").Where("id", "==", input.BorrowRequestID).Limit(1).Documents(ctx)
			doc, err := iter.Next()
			iter.Stop()
			if err != nil {
				http.Error(w, "No borrow request found matching this ID for your account", http.StatusNotFound)
				return
			}
			var fReq FirestoreBorrowRequest
			if err := doc.DataTo(&fReq); err != nil || !strings.EqualFold(fReq.BorrowerUsername, uCtx.Username) {
				http.Error(w, "No borrow request found matching this ID for your account", http.StatusNotFound)
				return
			}
			if fReq.Status != "accepted" {
				http.Error(w, "Cannot create a Mohalla Moment: borrow request has not been accepted by the lender yet", http.StatusBadRequest)
				return
			}
			realReqID = fReq.ID
			realLender = fReq.LenderUsername
			realItem = fReq.ItemName
			status = fReq.Status
		} else {
			iter := GetFirestore().Collection("borrow_requests").Where("borrowerUsername", "==", uCtx.Username).Where("status", "==", "accepted").Documents(ctx)
			var latestReq *FirestoreBorrowRequest
			for {
				doc, err := iter.Next()
				if err != nil {
					break
				}
				var fr FirestoreBorrowRequest
				if doc.DataTo(&fr) == nil {
					if latestReq == nil || fr.ID > latestReq.ID {
						latestReq = &fr
					}
				}
			}
			iter.Stop()
			if latestReq == nil {
				http.Error(w, "You must have an accepted borrow request from a neighbour before sharing a Mohalla Moment", http.StatusBadRequest)
				return
			}
			realReqID = latestReq.ID
			realLender = latestReq.LenderUsername
			realItem = latestReq.ItemName
			status = latestReq.Status
		}

		input.BorrowRequestID = realReqID
		input.LenderUsername = realLender
		input.ItemName = realItem

		if input.ItemCategory == "" || input.ItemCategory == "Borrowed Item" {
			itemIter := GetFirestore().Collection("items").Where("itemName", "==", realItem).Limit(1).Documents(ctx)
			if iDoc, iErr := itemIter.Next(); iErr == nil {
				var iData struct {
					Category string `firestore:"category"`
				}
				if iDoc.DataTo(&iData) == nil && iData.Category != "" {
					input.ItemCategory = iData.Category
				}
			}
			itemIter.Stop()
			if input.ItemCategory == "" {
				input.ItemCategory = "Borrowed Item"
			}
		}

		if input.Area == "" || input.Area == "Your Mohalla" {
			fUser, _ := getFirestoreUser(ctx, uCtx.Username)
			if fUser != nil && fUser.Area != "" {
				input.Area = fUser.Area
			} else {
				input.Area = "NEARBY"
			}
		}

		momentID := generateNumericID()
		savedPhotos := []string{}
		for idx, p := range input.Photos {
			p = strings.TrimSpace(p)
			if p == "" {
				continue
			}
			if strings.HasPrefix(p, "data:") {
				storageURL, err := GetStorageProvider().SaveDataURL(ctx, p, "moments", strconv.Itoa(momentID), fmt.Sprintf("moment-%d", idx))
				if err == nil && storageURL != "" {
					savedPhotos = append(savedPhotos, storageURL)
					continue
				} else if err != nil {
					log.Printf("[Storage] moment photo upload error: %v", err)
				}
			}
			savedPhotos = append(savedPhotos, p)
		}

		now := time.Now().UTC()
		mDocRef := GetFirestore().Collection("moments").NewDoc()
		fMoment := FirestoreMohallaMoment{
			ID:               momentID,
			DocID:            mDocRef.ID,
			BorrowRequestID:  input.BorrowRequestID,
			BorrowerUsername: uCtx.Username,
			LenderUsername:   input.LenderUsername,
			ItemName:         input.ItemName,
			ItemCategory:     input.ItemCategory,
			UsageHeadline:    input.UsageHeadline,
			UsageDescription: input.UsageDescription,
			ThankYouMessage:  input.ThankYouMessage,
			Photos:           savedPhotos,
			Area:             input.Area,
			CreatedAt:        now,
		}

		if _, err := mDocRef.Set(ctx, fMoment); err != nil {
			log.Printf("Error creating Firestore moment: %v", err)
			http.Error(w, "Failed to create moment: "+err.Error(), http.StatusInternalServerError)
			return
		}

		w.WriteHeader(http.StatusCreated)
		json.NewEncoder(w).Encode(map[string]interface{}{
			"success": true,
			"id":      momentID,
			"message": "Mohalla Moment published successfully",
		})
		return
	}

	// SQLite fallback
	if input.BorrowRequestID > 0 {
		err := db.QueryRow(`SELECT id, lender_username, item_name, status FROM borrow_requests WHERE id = ? AND borrower_username = ?`, input.BorrowRequestID, uCtx.Username).Scan(&realReqID, &realLender, &realItem, &status)
		if err != nil {
			http.Error(w, "No borrow request found matching this ID for your account", http.StatusNotFound)
			return
		}
		if status != "accepted" {
			http.Error(w, "Cannot create a Mohalla Moment: borrow request has not been accepted by the lender yet", http.StatusBadRequest)
			return
		}
	} else {
		// Attempt to link to their most recent accepted borrow request
		err := db.QueryRow(`SELECT id, lender_username, item_name FROM borrow_requests WHERE borrower_username = ? AND status = 'accepted' ORDER BY id DESC LIMIT 1`, uCtx.Username).Scan(&realReqID, &realLender, &realItem)
		if err != nil {
			http.Error(w, "You must have an accepted borrow request from a neighbour before sharing a Mohalla Moment", http.StatusBadRequest)
			return
		}
	}

	input.BorrowRequestID = realReqID
	input.LenderUsername = realLender
	input.ItemName = realItem

	if input.ItemCategory == "" || input.ItemCategory == "Borrowed Item" {
		var cat string
		_ = db.QueryRow(`SELECT category FROM lent_items WHERE item_name = ? LIMIT 1`, realItem).Scan(&cat)
		if cat != "" {
			input.ItemCategory = cat
		} else {
			input.ItemCategory = "Borrowed Item"
		}
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

	// Persist uploaded photos to disk storage if base64
	savedPhotos := []string{}
	for _, p := range input.Photos {
		p = strings.TrimSpace(p)
		if p == "" {
			continue
		}
		if strings.HasPrefix(p, "data:") {
			savedPath, err := persistItemImage(p)
			if err == nil && savedPath != "" {
				savedPhotos = append(savedPhotos, savedPath)
				continue
			}
		}
		savedPhotos = append(savedPhotos, p)
	}

	photosJSON, _ := json.Marshal(savedPhotos)

	if IsFirebaseEnabled() {
		momentID := generateNumericID()
		now := time.Now().UTC()
		fMoment := FirestoreMohallaMoment{
			ID:               momentID,
			DocID:            strconv.Itoa(momentID),
			BorrowRequestID:  input.BorrowRequestID,
			BorrowerUsername: uCtx.Username,
			LenderUsername:   input.LenderUsername,
			ItemName:         input.ItemName,
			ItemCategory:     input.ItemCategory,
			UsageHeadline:    input.UsageHeadline,
			UsageDescription: input.UsageDescription,
			ThankYouMessage:  input.ThankYouMessage,
			Photos:           savedPhotos,
			Area:             input.Area,
			CreatedAt:        now,
		}
		_, _ = GetFirestore().Collection("moments").Doc(fMoment.DocID).Set(r.Context(), fMoment)
		if isSQLiteFallbackDisabled() {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusCreated)
			json.NewEncoder(w).Encode(map[string]interface{}{
				"message": "Mohalla moment shared successfully",
				"id":      momentID,
			})
			return
		}
	}

	if !isSQLiteFallbackDisabled() && db != nil {
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
			http.Error(w, "Database error: "+err.Error(), http.StatusInternalServerError)
			return
		}
		mID, _ := res.LastInsertId()
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusCreated)
		json.NewEncoder(w).Encode(map[string]interface{}{
			"message": "Mohalla moment shared successfully",
			"id":      mID,
		})
		return
	}

	http.Error(w, "Database error: SQLite disabled and Firestore unavailable", http.StatusInternalServerError)
}

func main() {
	loadEnvFiles()

	// Phase 1: Initialize Firebase connection (standby if credentials not yet configured)
	ctx := context.Background()
	fbService, fbErr := InitFirebase(ctx)
	if fbErr != nil {
		log.Printf("[Firebase] Initialization notice: %v\n", fbErr)
	} else if fbService != nil && fbService.Enabled {
		log.Printf("[Firebase] Enabled. Checking Firestore connectivity...")
		if pingErr := fbService.PingFirestore(ctx); pingErr != nil {
			log.Printf("[Firebase] Firestore connectivity check: %v\n", pingErr)
		} else {
			log.Printf("[Firebase] Firestore connection VERIFIED successfully!\n")
		}
		defer fbService.Close()
	}

	InitStorageProvider()

	initDB()
	if db != nil {
		defer db.Close()
	}

	go hub.run()

	allowedOriginsEnv := os.Getenv("ALLOWED_ORIGINS")
	if allowedOriginsEnv == "" {
		allowedOriginsEnv = os.Getenv("ALLOWED_ORIGIN")
	}

	var allowedOrigins []string
	if allowedOriginsEnv != "" && allowedOriginsEnv != "*" {
		for _, o := range strings.Split(allowedOriginsEnv, ",") {
			o = strings.TrimSpace(o)
			if o != "" {
				allowedOrigins = append(allowedOrigins, o)
			}
		}
	}

	defaultProductionOrigins := []string{
		"https://mohalla-frontend.onrender.com",
	}

	defaultDevOrigins := []string{
		"http://localhost:5173",
		"http://localhost:8080",
		"http://localhost:8081",
		"http://localhost:3000",
		"http://127.0.0.1:5173",
		"http://127.0.0.1:8080",
		"http://127.0.0.1:8081",
		"http://127.0.0.1:3000",
	}

	isAllowedOrigin := func(origin string) (bool, string) {
		if origin == "" {
			return true, ""
		}
		for _, ao := range allowedOrigins {
			if strings.EqualFold(ao, origin) {
				return true, origin
			}
		}
		for _, po := range defaultProductionOrigins {
			if strings.EqualFold(po, origin) {
				return true, origin
			}
		}
		if !isProductionMode() {
			for _, ddo := range defaultDevOrigins {
				if strings.EqualFold(ddo, origin) {
					return true, origin
				}
			}
			if strings.HasPrefix(origin, "http://localhost:") || strings.HasPrefix(origin, "http://127.0.0.1:") {
				return true, origin
			}
		}
		return false, ""
	}

	corsMiddleware := func(next http.HandlerFunc) http.HandlerFunc {
		return func(w http.ResponseWriter, r *http.Request) {
			origin := r.Header.Get("Origin")
			allowed, matchedOrigin := isAllowedOrigin(origin)
			if allowed && matchedOrigin != "" {
				w.Header().Set("Access-Control-Allow-Origin", matchedOrigin)
				w.Header().Set("Access-Control-Allow-Credentials", "true")
			} else if allowedOriginsEnv == "*" && !isProductionMode() {
				w.Header().Set("Access-Control-Allow-Origin", "*")
			}
			w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
			w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With, Accept, Origin")
			w.Header().Set("Access-Control-Max-Age", "86400")
			w.Header().Set("Vary", "Origin")

			if r.Method == http.MethodOptions {
				if !allowed {
					w.WriteHeader(http.StatusForbidden)
					return
				}
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
	http.HandleFunc("/api/items", corsMiddleware(func(w http.ResponseWriter, r *http.Request) {
		if r.Method == http.MethodGet {
			getItemsHandler(w, r)
		} else if r.Method == http.MethodDelete {
			JWTMiddleware(deleteItemHandler)(w, r)
		} else {
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		}
	}))
	http.HandleFunc("/api/items/delete", corsMiddleware(JWTMiddleware(deleteItemHandler)))

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

	// Firebase status & connectivity verification endpoint (Phase 1)
	http.HandleFunc("/api/firebase/status", corsMiddleware(func(w http.ResponseWriter, r *http.Request) {
		status := map[string]interface{}{
			"enabled":             IsFirebaseEnabled(),
			"project_id":          "",
			"storage_bucket":      "",
			"firestore_connected": false,
		}
		if Firebase != nil {
			status["project_id"] = Firebase.ProjectID
			status["storage_bucket"] = Firebase.BucketName
			if Firebase.Enabled {
				pingCtx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
				defer cancel()
				if err := Firebase.PingFirestore(pingCtx); err == nil {
					status["firestore_connected"] = true
					status["message"] = "Firestore is connected and responsive"
				} else {
					status["firestore_error"] = err.Error()
					status["message"] = "Firestore client initialized but ping failed"
				}
			} else {
				if Firebase.InitErr != nil {
					status["error"] = Firebase.InitErr.Error()
				}
				status["message"] = "Firebase is in standby mode (no credentials provided or init failed). Fallback SQLite active."
			}
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(status)
	}))

	port := os.Getenv("PORT")
	if port == "" {
		port = "8085"
	}
	log.Printf("Backend server running on http://localhost:%s\n", port)
	log.Fatal(http.ListenAndServe(":"+port, nil))
}

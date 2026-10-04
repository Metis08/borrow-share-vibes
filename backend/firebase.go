package main

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"strings"

	"cloud.google.com/go/firestore"
	cloudstorage "cloud.google.com/go/storage"
	firebase "firebase.google.com/go/v4"
	firebasestorage "firebase.google.com/go/v4/storage"
	"google.golang.org/api/iterator"
	"google.golang.org/api/option"
)

// FirebaseService encapsulates the Firebase App, Firestore, and Cloud Storage clients.
type FirebaseService struct {
	App           *firebase.App
	Firestore     *firestore.Client
	StorageClient *firebasestorage.Client
	StorageBucket *cloudstorage.BucketHandle
	ProjectID     string
	BucketName    string
	Enabled       bool
	InitErr       error
}

// Global Firebase instance
var Firebase *FirebaseService

// ServiceAccountConfig is a lightweight struct to extract projectId from raw credentials if not provided.
type serviceAccountConfig struct {
	ProjectID   string `json:"project_id"`
	ClientEmail string `json:"client_email"`
}

func loadEnvFiles() {
	paths := []string{".env", "../.env", "backend/.env"}
	for _, p := range paths {
		data, err := os.ReadFile(p)
		if err != nil {
			continue
		}
		lines := strings.Split(string(data), "\n")
		for _, line := range lines {
			line = strings.TrimSpace(line)
			if line == "" || strings.HasPrefix(line, "#") {
				continue
			}
			parts := strings.SplitN(line, "=", 2)
			if len(parts) == 2 {
				key := strings.TrimSpace(parts[0])
				val := strings.Trim(strings.TrimSpace(parts[1]), "\"'`")
				if os.Getenv(key) == "" {
					os.Setenv(key, val)
				}
			}
		}
	}
}

// InitFirebase initializes the Firebase Admin SDK, Firestore client, and Storage client.
// It prioritizes environment variables in this order:
// 1. FIREBASE_SERVICE_ACCOUNT_JSON (raw JSON string)
// 2. FIREBASE_CREDENTIALS (file path to service account key)
// 3. GOOGLE_APPLICATION_CREDENTIALS (standard GCP env var)
//
// If no credentials are found, it logs an informational message and returns a disabled
// service instance without crashing the backend, enabling smooth local development.
func InitFirebase(ctx context.Context) (*FirebaseService, error) {
	loadEnvFiles()

	service := &FirebaseService{
		Enabled: false,
	}

	rawJSON := strings.TrimSpace(os.Getenv("FIREBASE_SERVICE_ACCOUNT_JSON"))
	credFilePath := strings.TrimSpace(os.Getenv("FIREBASE_CREDENTIALS"))
	if credFilePath == "" {
		credFilePath = strings.TrimSpace(os.Getenv("GOOGLE_APPLICATION_CREDENTIALS"))
	}

	projectID := strings.TrimSpace(os.Getenv("FIREBASE_PROJECT_ID"))
	bucketName := strings.TrimSpace(os.Getenv("FIREBASE_STORAGE_BUCKET"))

	var opts []option.ClientOption

	if rawJSON != "" {
		log.Printf("[Firebase] Loading credentials from FIREBASE_SERVICE_ACCOUNT_JSON env variable")
		opts = append(opts, option.WithCredentialsJSON([]byte(rawJSON)))

		if projectID == "" {
			var sa serviceAccountConfig
			if err := json.Unmarshal([]byte(rawJSON), &sa); err == nil && sa.ProjectID != "" {
				projectID = sa.ProjectID
			}
		}
	} else if credFilePath != "" {
		// Clean and resolve the file path
		cleanPath := filepath.Clean(credFilePath)
		fileBytes, err := os.ReadFile(cleanPath)
		if err != nil {
			msg := fmt.Sprintf("[Firebase] Warning: Failed to read credentials file '%s': %v", cleanPath, err)
			log.Println(msg)
			service.InitErr = errors.New(msg)
			Firebase = service
			return service, service.InitErr
		}

		log.Printf("[Firebase] Loading credentials from file: %s", cleanPath)
		opts = append(opts, option.WithCredentialsJSON(fileBytes))

		var sa serviceAccountConfig
		if err := json.Unmarshal(fileBytes, &sa); err == nil && sa.ProjectID != "" {
			projectID = sa.ProjectID
		}
	} else {
		log.Println("[Firebase] Notice: No credentials configured (neither FIREBASE_CREDENTIALS nor FIREBASE_SERVICE_ACCOUNT_JSON).")
		log.Println("[Firebase] Firebase is running in STANDBY mode. Existing SQLite database and endpoints remain active.")
		Firebase = service
		return service, nil
	}

	fbConfig := &firebase.Config{
		ProjectID: projectID,
	}
	if bucketName != "" {
		fbConfig.StorageBucket = bucketName
	}

	app, err := firebase.NewApp(ctx, fbConfig, opts...)
	if err != nil {
		service.InitErr = fmt.Errorf("failed to initialize Firebase App: %w", err)
		log.Printf("[Firebase] ERROR: %v", service.InitErr)
		Firebase = service
		return service, service.InitErr
	}
	service.App = app
	service.ProjectID = projectID

	// Initialize Firestore
	firestoreClient, err := app.Firestore(ctx)
	if err != nil {
		service.InitErr = fmt.Errorf("failed to initialize Firestore client: %w", err)
		log.Printf("[Firebase] ERROR: %v", service.InitErr)
		Firebase = service
		return service, service.InitErr
	}
	service.Firestore = firestoreClient

	// Initialize Firebase Storage
	storageClient, err := app.Storage(ctx)
	if err != nil {
		service.InitErr = fmt.Errorf("failed to initialize Firebase Storage client: %w", err)
		log.Printf("[Firebase] ERROR: %v", service.InitErr)
		Firebase = service
		return service, service.InitErr
	}
	service.StorageClient = storageClient

	if bucketName != "" {
		bucketHandle, err := storageClient.Bucket(bucketName)
		if err != nil {
			log.Printf("[Firebase] Warning: Could not get bucket handle for '%s': %v", bucketName, err)
		} else {
			service.StorageBucket = bucketHandle
			service.BucketName = bucketName
		}
	}

	service.Enabled = true
	Firebase = service
	log.Printf("[Firebase] Successfully connected to Firebase Admin SDK (Project ID: %s, Storage Bucket: %s)", projectID, bucketName)

	return service, nil
}

// PingFirestore verifies network connectivity and authentication against Firestore.
func (s *FirebaseService) PingFirestore(ctx context.Context) error {
	if s == nil || !s.Enabled || s.Firestore == nil {
		return errors.New("firestore client is not enabled or initialized")
	}

	// List collections with iterator: fetching the first collection or reaching Done confirms valid credentials & network
	iter := s.Firestore.Collections(ctx)
	_, err := iter.Next()
	if err != nil && err != iterator.Done {
		return fmt.Errorf("firestore ping failed: %w", err)
	}

	return nil
}

// Close gracefully closes Firestore and Storage connections.
func (s *FirebaseService) Close() {
	if s != nil && s.Firestore != nil {
		if err := s.Firestore.Close(); err != nil {
			log.Printf("[Firebase] Error closing Firestore client: %v", err)
		}
	}
}

// Helper getters

// GetFirestore returns the active Firestore client, or nil if not enabled.
func GetFirestore() *firestore.Client {
	if Firebase != nil && Firebase.Enabled {
		return Firebase.Firestore
	}
	return nil
}

// GetStorageBucket returns the active Cloud Storage bucket handle, or nil if not enabled.
func GetStorageBucket() *cloudstorage.BucketHandle {
	if Firebase != nil && Firebase.Enabled {
		return Firebase.StorageBucket
	}
	return nil
}

// IsFirebaseEnabled returns whether Firebase is successfully initialized and enabled.
func IsFirebaseEnabled() bool {
	return Firebase != nil && Firebase.Enabled
}

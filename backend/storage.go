package main

import (
	"context"
	"encoding/base64"
	"errors"
	"fmt"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"
)

// MaxImageBytes defines the maximum allowed image file size (5 MB).
const MaxImageBytes = 5 * 1024 * 1024

// allowedMIMETypes maps permitted image MIME types to standard file extensions.
var allowedMIMETypes = map[string]string{
	"image/jpeg": ".jpg",
	"image/jpg":  ".jpg",
	"image/png":  ".png",
	"image/webp": ".webp",
	"image/gif":  ".gif",
}

// StorageProvider abstracts image persistence across different storage backends.
//
// Current Architecture:
//
//	Application Layer
//	       ↓
//	StorageProvider (interface)
//	       ↓
//	LocalStorageProvider (ACTIVE NOW: development & self-hosted filesystem storage)
//	       ↓
//	[Future Providers: FirebaseStorageProvider, CloudinaryStorageProvider]
type StorageProvider interface {
	// Save persists raw image bytes in the specified category (e.g., "items", "profiles", "moments")
	// and returns the public reference/URL string.
	Save(ctx context.Context, file []byte, filename string, contentType string, category string) (string, error)

	// SaveDataURL processes and validates a base64 Data URL, generating a safe unique filename under category/entityID.
	SaveDataURL(ctx context.Context, dataURL string, category string, entityID string, prefix string) (string, error)

	// Delete removes a stored image reference if local or supported by the provider.
	Delete(ctx context.Context, imageURL string) error
}

// LocalStorageProvider implements StorageProvider using the local server filesystem under UPLOAD_DIR (default: ./uploads).
type LocalStorageProvider struct {
	uploadDir string
}

// NewLocalStorageProvider creates a new LocalStorageProvider rooted at the provided base directory.
func NewLocalStorageProvider(uploadDir string) *LocalStorageProvider {
	if uploadDir == "" {
		uploadDir = "./uploads"
	}
	_ = os.MkdirAll(filepath.Join(uploadDir, "items"), 0755)
	_ = os.MkdirAll(filepath.Join(uploadDir, "profiles"), 0755)
	_ = os.MkdirAll(filepath.Join(uploadDir, "moments"), 0755)

	return &LocalStorageProvider{
		uploadDir: filepath.Clean(uploadDir),
	}
}

// sanitizeSegment removes dangerous characters and prevents directory traversal.
func sanitizeSegment(seg string) string {
	seg = filepath.Base(filepath.Clean(seg))
	if seg == "." || seg == "/" || seg == "\\" || seg == ".." {
		return "default"
	}
	var b strings.Builder
	for _, r := range seg {
		if (r >= 'a' && r <= 'z') || (r >= 'A' && r <= 'Z') || (r >= '0' && r <= '9') || r == '-' || r == '_' {
			b.WriteRune(r)
		}
	}
	res := b.String()
	if res == "" {
		return "default"
	}
	return res
}

// cleanCategoryPath safely formats category and subfolder paths, stripping any ".." or absolute paths.
func cleanCategoryPath(cat string) string {
	cat = filepath.ToSlash(filepath.Clean(cat))
	cat = strings.Trim(cat, "/")
	parts := strings.Split(cat, "/")
	var cleanParts []string
	for _, p := range parts {
		sp := sanitizeSegment(p)
		if sp != "" && sp != "." && sp != ".." {
			cleanParts = append(cleanParts, sp)
		}
	}
	if len(cleanParts) == 0 {
		return "general"
	}
	return filepath.Join(cleanParts...)
}

// validateImage checks file size, header magic bytes, and allowed image MIME types.
func validateImage(data []byte, declaredMIME string) (string, string, error) {
	if len(data) == 0 {
		return "", "", errors.New("empty image data")
	}
	if len(data) > MaxImageBytes {
		return "", "", fmt.Errorf("image size (%d bytes) exceeds maximum limit of %d MB", len(data), MaxImageBytes/(1024*1024))
	}

	sampleLen := 512
	if len(data) < sampleLen {
		sampleLen = len(data)
	}
	detected := http.DetectContentType(data[:sampleLen])
	declared := strings.ToLower(strings.TrimSpace(declaredMIME))

	var matchedMIME string
	var ext string

	if e, ok := allowedMIMETypes[detected]; ok {
		matchedMIME = detected
		ext = e
	} else if e, ok := allowedMIMETypes[declared]; ok {
		// Verify WebP if detected as octet-stream
		if declared == "image/webp" && len(data) >= 12 && string(data[:4]) == "RIFF" && string(data[8:12]) == "WEBP" {
			matchedMIME = "image/webp"
			ext = ".webp"
		} else if strings.HasPrefix(declared, "image/") {
			matchedMIME = declared
			ext = e
		}
	}

	if matchedMIME == "" {
		return "", "", fmt.Errorf("unsupported or non-image content type: detected '%s', declared '%s'", detected, declared)
	}

	return matchedMIME, ext, nil
}

// Save persists raw image bytes in the specified category under uploadDir.
func (p *LocalStorageProvider) Save(ctx context.Context, file []byte, filename string, contentType string, category string) (string, error) {
	_, ext, err := validateImage(file, contentType)
	if err != nil {
		return "", err
	}

	cleanCat := cleanCategoryPath(category)
	absUploadDir, err := filepath.Abs(p.uploadDir)
	if err != nil {
		return "", fmt.Errorf("failed to resolve uploads directory: %w", err)
	}

	targetDir := filepath.Join(absUploadDir, cleanCat)
	rel, err := filepath.Rel(absUploadDir, targetDir)
	if err != nil || strings.HasPrefix(rel, "..") {
		return "", errors.New("invalid storage category path: path traversal detected")
	}

	if err := os.MkdirAll(targetDir, 0755); err != nil {
		return "", fmt.Errorf("failed to create directory: %w", err)
	}

	cleanName := filepath.Base(filepath.Clean(filename))
	if cleanName == "" || cleanName == "." || cleanName == "/" || strings.Contains(cleanName, "..") {
		cleanName = fmt.Sprintf("upload-%d%s", time.Now().UnixNano(), ext)
	} else {
		cleanName = sanitizeSegment(strings.TrimSuffix(cleanName, filepath.Ext(cleanName))) + ext
	}

	targetFile := filepath.Join(targetDir, cleanName)
	if err := os.WriteFile(targetFile, file, 0644); err != nil {
		return "", fmt.Errorf("failed to write image file: %w", err)
	}

	// Preserve the exact existing URL contract: /uploads/...
	return "/" + filepath.ToSlash(filepath.Join("uploads", cleanCat, cleanName)), nil
}

// SaveDataURL decodes and validates a base64 Data URL, saving it with safe naming under category/entityID.
func (p *LocalStorageProvider) SaveDataURL(ctx context.Context, dataURL string, category string, entityID string, prefix string) (string, error) {
	dataURL = strings.TrimSpace(dataURL)
	if dataURL == "" {
		return "", nil
	}

	// If already a persisted URL or external URL, return as-is
	if strings.HasPrefix(dataURL, "/uploads/") || strings.HasPrefix(dataURL, "http://") || strings.HasPrefix(dataURL, "https://") {
		return dataURL, nil
	}

	if !strings.HasPrefix(dataURL, "data:") {
		return "", errors.New("invalid image data format: missing data: prefix")
	}

	comma := strings.Index(dataURL, ",")
	if comma < 0 {
		return "", errors.New("invalid data URL: missing comma delimiter")
	}

	meta := strings.ToLower(dataURL[:comma])
	payload := dataURL[comma+1:]
	raw, err := base64.StdEncoding.DecodeString(payload)
	if err != nil {
		raw, err = base64.RawStdEncoding.DecodeString(payload)
		if err != nil {
			return "", fmt.Errorf("could not decode base64 image data: %w", err)
		}
	}

	declaredMIME := ""
	if semi := strings.Index(meta, ";"); semi > 5 {
		declaredMIME = meta[5:semi]
	} else if len(meta) > 5 {
		declaredMIME = meta[5:]
	}

	safePrefix := sanitizeSegment(prefix)
	if safePrefix == "" || safePrefix == "default" {
		safePrefix = "img"
	}

	filename := fmt.Sprintf("%s-%d", safePrefix, time.Now().UnixNano())

	var catPath string
	if entityID != "" {
		catPath = filepath.ToSlash(filepath.Join(category, entityID))
	} else {
		catPath = category
	}

	return p.Save(ctx, raw, filename, declaredMIME, catPath)
}

// Delete removes a stored image file from the local upload directory if it exists.
func (p *LocalStorageProvider) Delete(ctx context.Context, imageURL string) error {
	imageURL = strings.TrimSpace(imageURL)
	if imageURL == "" {
		return nil
	}

	// Only process paths belonging to /uploads/
	rel := ""
	if strings.HasPrefix(imageURL, "/uploads/") {
		rel = strings.TrimPrefix(imageURL, "/uploads/")
	} else if strings.HasPrefix(imageURL, "uploads/") {
		rel = strings.TrimPrefix(imageURL, "uploads/")
	} else {
		return nil
	}

	absUploadDir, err := filepath.Abs(p.uploadDir)
	if err != nil {
		return err
	}

	cleanRel := filepath.Clean(rel)
	targetPath := filepath.Join(absUploadDir, cleanRel)

	checkRel, err := filepath.Rel(absUploadDir, targetPath)
	if err != nil || strings.HasPrefix(checkRel, "..") {
		return errors.New("path traversal detected in image delete request")
	}

	err = os.Remove(targetPath)
	if err != nil && !os.IsNotExist(err) {
		return fmt.Errorf("failed to delete image file: %w", err)
	}

	return nil
}

// Global StorageProvider singleton
var (
	currentStorageProvider StorageProvider
	storageProviderOnce    sync.Once
)

// InitStorageProvider initializes the configured storage provider.
//
// Supported environment variables:
//
//	STORAGE_PROVIDER: "local" (default)
//	UPLOAD_DIR:       "./uploads" (default)
func InitStorageProvider() StorageProvider {
	storageProviderOnce.Do(func() {
		providerType := strings.ToLower(strings.TrimSpace(os.Getenv("STORAGE_PROVIDER")))
		if providerType == "" {
			providerType = "local"
		}

		uploadDir := strings.TrimSpace(os.Getenv("UPLOAD_DIR"))
		if uploadDir == "" {
			uploadDir = "./uploads"
		}

		switch providerType {
		case "local":
			currentStorageProvider = NewLocalStorageProvider(uploadDir)
			log.Printf("[Storage] Initialized LocalStorageProvider (directory: %s)", uploadDir)
		default:
			log.Printf("[Storage] Unknown STORAGE_PROVIDER '%s', defaulting to LocalStorageProvider", providerType)
			currentStorageProvider = NewLocalStorageProvider(uploadDir)
		}
	})
	return currentStorageProvider
}

// GetStorageProvider returns the active StorageProvider instance, initializing it if needed.
func GetStorageProvider() StorageProvider {
	if currentStorageProvider == nil {
		return InitStorageProvider()
	}
	return currentStorageProvider
}

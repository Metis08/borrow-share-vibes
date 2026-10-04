package main

import (
	"context"
	"encoding/base64"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

// Minimal 1x1 transparent PNG data
var samplePNG = []byte{
	0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D,
	0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
	0x08, 0x06, 0x00, 0x00, 0x00, 0x1F, 0x15, 0xC4, 0x89, 0x00, 0x00, 0x00,
	0x0A, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9C, 0x63, 0x00, 0x01, 0x00, 0x00,
	0x05, 0x00, 0x01, 0x0D, 0x0A, 0x2D, 0xB4, 0x00, 0x00, 0x00, 0x00, 0x49,
	0x45, 0x4E, 0x44, 0xAE, 0x42, 0x60, 0x82,
}

func TestLocalStorageProvider_SaveAndServe(t *testing.T) {
	tempDir, err := os.MkdirTemp("", "mohalla_storage_test_*")
	if err != nil {
		t.Fatalf("Failed to create temp dir: %v", err)
	}
	defer os.RemoveAll(tempDir)

	provider := NewLocalStorageProvider(tempDir)
	ctx := context.Background()

	// 1. Test Save raw bytes
	url, err := provider.Save(ctx, samplePNG, "test.png", "image/png", "items/test-item")
	if err != nil {
		t.Fatalf("Failed to save image: %v", err)
	}
	if !strings.HasPrefix(url, "/uploads/items/test-item/") {
		t.Errorf("Expected URL to start with /uploads/items/test-item/, got %s", url)
	}

	// Verify file actually exists on disk
	relPath := strings.TrimPrefix(url, "/uploads/")
	diskPath := filepath.Join(tempDir, relPath)
	if _, err := os.Stat(diskPath); err != nil {
		t.Errorf("Saved file does not exist on disk: %v", err)
	}

	// 2. Test SaveDataURL
	dataURL := "data:image/png;base64," + base64.StdEncoding.EncodeToString(samplePNG)
	url2, err := provider.SaveDataURL(ctx, dataURL, "profiles", "user123", "profile")
	if err != nil {
		t.Fatalf("Failed to save data URL: %v", err)
	}
	if !strings.HasPrefix(url2, "/uploads/profiles/user123/") {
		t.Errorf("Expected URL to start with /uploads/profiles/user123/, got %s", url2)
	}

	// 3. Test Pass-through of already-persisted URL
	existingURL := "/uploads/items/CUBC2lLXNa7lzj1aNxfE/item-1790754694474796000.jpg"
	passthrough, err := provider.SaveDataURL(ctx, existingURL, "items", "CUBC", "item")
	if err != nil || passthrough != existingURL {
		t.Errorf("Expected passthrough of existing URL, got %s, err: %v", passthrough, err)
	}

	// 4. Test Max Size Validation (> 5MB rejected)
	oversized := make([]byte, 6*1024*1024)
	copy(oversized, samplePNG)
	_, err = provider.Save(ctx, oversized, "large.png", "image/png", "items")
	if err == nil {
		t.Errorf("Expected error for oversized file > 5MB, got nil")
	}

	// 5. Test Non-Image MIME Rejection
	badPayload := []byte("<html><body>not an image</body></html>")
	_, err = provider.Save(ctx, badPayload, "bad.html", "text/html", "items")
	if err == nil {
		t.Errorf("Expected error for non-image MIME type, got nil")
	}

	// 6. Test Path Traversal Protection
	urlEscape, err := provider.Save(ctx, samplePNG, "../../escape.png", "image/png", "../../secret")
	if err != nil {
		t.Fatalf("Save with malicious path failed unexpectedly: %v", err)
	}
	// Verify it was sanitized and stayed within uploadDir
	if strings.Contains(urlEscape, "..") {
		t.Errorf("Returned URL must not contain path traversal: %s", urlEscape)
	}
	escapePath := filepath.Join(tempDir, strings.TrimPrefix(urlEscape, "/uploads/"))
	if _, err := os.Stat(escapePath); err != nil {
		t.Errorf("Sanitized file path should be safely contained in uploadDir: %v", err)
	}

	// 7. Test Delete
	if err := provider.Delete(ctx, url); err != nil {
		t.Errorf("Failed to delete image: %v", err)
	}
	if _, err := os.Stat(diskPath); !os.IsNotExist(err) {
		t.Errorf("File should have been deleted from disk")
	}
}

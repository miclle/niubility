// Command import is a standalone CLI tool for importing legacy platform content.
// It reads a JSON file, downloads/uploads files to S3 via presigned URLs,
// and creates content via the platform API.
//
// Usage:
//
//	go run cmd/import/main.go \
//	  --server http://localhost:9000 \
//	  --username admin --password xxx \
//	  --file tmp/talks-sharing.json \
//	  --category learning \
//	  --workers 5
package main

import (
	"bytes"
	"encoding/json"
	"flag"
	"fmt"
	"io"
	"log"
	"mime"
	"net/http"
	"net/http/cookiejar"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"sync/atomic"
	"time"
)

// LegacyTalk represents the data structure from the old platform.
type LegacyTalk struct {
	ID          string    `json:"id"`
	Title       string    `json:"title"`
	Cover       string    `json:"cover"`
	Description string    `json:"description"`
	Tags        []string  `json:"tags"`
	Speaker     string    `json:"speaker"`
	Bio         string    `json:"bio"`
	Playback    string    `json:"playback"`
	Type        string    `json:"type"`
	CreatedAt   time.Time `json:"created_at"`
}

// presignResponse is the API response for presigned URL requests.
type presignResponse struct {
	PresignedURL string `json:"presigned_url"`
	Key          string `json:"key"`
}

// searchUsersResponse is the API response for user search.
type searchUsersResponse struct {
	Items []struct {
		ID   string `json:"id"`
		Name string `json:"name"`
	} `json:"items"`
}

// createContentRequest is the API request for creating content.
type createContentRequest struct {
	Title       string             `json:"title"`
	Summary     string             `json:"summary"`
	Body        string             `json:"body"`
	CoverURL    string             `json:"cover_url,omitempty"`
	Type        string             `json:"type"`
	Status      string             `json:"status"`
	Category    string             `json:"category"`
	Tags        []string           `json:"tags"`
	SpeakerID   string             `json:"speaker_id,omitempty"`
	SpeakerName string             `json:"speaker_name,omitempty"`
	SpeakerBio  string             `json:"speaker_bio,omitempty"`
	CreatedAt   *time.Time         `json:"created_at,omitempty"`
	Attachments []attachmentCreate `json:"attachments,omitempty"`
}

// attachmentCreate is the attachment creation payload.
type attachmentCreate struct {
	URL       string `json:"url"`
	Type      string `json:"type"`
	SortOrder int    `json:"sort_order"`
}

func main() {
	server := flag.String("server", "http://localhost:9000", "Platform server address")
	username := flag.String("username", "", "Admin username (required)")
	password := flag.String("password", "", "Admin password (required)")
	file := flag.String("file", "", "JSON file path (required)")
	category := flag.String("category", "", "Category slug: learning or culture (required)")
	workers := flag.Int("workers", 5, "Number of concurrent workers")
	flag.Parse()

	if *username == "" || *password == "" || *file == "" || *category == "" {
		flag.Usage()
		os.Exit(1)
	}

	// Set up HTTP client with cookie jar
	jar, _ := cookiejar.New(nil)
	client := &http.Client{
		Jar:     jar,
		Timeout: 0, // No timeout for large file transfers
	}

	// Step 1: Login
	log.Println("Logging in...")
	if err := login(client, *server, *username, *password); err != nil {
		log.Fatalf("Login failed: %v", err)
	}
	log.Println("Login successful")

	// Step 2: Read and parse JSON
	log.Printf("Reading %s...\n", *file)
	talks, err := readTalks(*file)
	if err != nil {
		log.Fatalf("Failed to read JSON: %v", err)
	}
	log.Printf("Loaded %d talks\n", len(talks))

	// Step 3: Build speaker cache
	log.Println("Building speaker cache...")
	speakerCache := buildSpeakerCache(client, *server, talks)
	log.Printf("Cached %d speakers\n", len(speakerCache))

	// Step 4: Process talks with worker pool
	var (
		succeeded int64
		failed    int64
		skipped   int64
		total     = len(talks)
		sem       = make(chan struct{}, *workers)
		wg        sync.WaitGroup
	)

	for i, talk := range talks {
		if talk.Title == "" {
			atomic.AddInt64(&skipped, 1)
			continue
		}

		wg.Add(1)
		sem <- struct{}{}

		go func(idx int, t LegacyTalk) {
			defer wg.Done()
			defer func() { <-sem }()

			log.Printf("[%d/%d] %s", idx+1, total, t.Title)

			if err := processTalk(client, *server, *category, t, speakerCache); err != nil {
				log.Printf("[%d/%d] FAILED: %s: %v", idx+1, total, t.Title, err)
				atomic.AddInt64(&failed, 1)
				return
			}

			atomic.AddInt64(&succeeded, 1)
		}(i, talk)
	}

	wg.Wait()

	log.Printf("\nResults: total=%d succeeded=%d failed=%d skipped=%d",
		total, succeeded, failed, skipped)
}

// login authenticates with the platform and stores the session cookie.
func login(client *http.Client, server, username, password string) error {
	body, _ := json.Marshal(map[string]string{
		"username": username,
		"password": password,
	})

	resp, err := client.Post(server+"/api/v1/login", "application/json", bytes.NewReader(body))
	if err != nil {
		return fmt.Errorf("request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		b, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("status %d: %s", resp.StatusCode, string(b))
	}

	return nil
}

// readTalks reads and parses the JSON file into LegacyTalk slice.
func readTalks(path string) ([]LegacyTalk, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}

	var talks []LegacyTalk
	if err := json.Unmarshal(data, &talks); err != nil {
		return nil, fmt.Errorf("parse JSON: %w", err)
	}

	return talks, nil
}

// buildSpeakerCache searches for speakers by name and returns a name→userID map.
func buildSpeakerCache(client *http.Client, server string, talks []LegacyTalk) map[string]string {
	cache := make(map[string]string)
	seen := make(map[string]bool)

	for _, t := range talks {
		name := strings.TrimSpace(t.Speaker)
		if name == "" || seen[name] {
			continue
		}
		seen[name] = true

		userID, err := searchUser(client, server, name)
		if err != nil {
			log.Printf("Speaker search failed for %q: %v", name, err)
			continue
		}
		if userID != "" {
			cache[name] = userID
			log.Printf("  Speaker %q → %s", name, userID)
		}
	}

	return cache
}

// searchUser searches for a user by name and returns the user ID if found.
func searchUser(client *http.Client, server, name string) (string, error) {
	resp, err := client.Get(server + "/api/v1/users/search?q=" + url.QueryEscape(name))
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("status %d", resp.StatusCode)
	}

	var result searchUsersResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return "", err
	}

	// Exact name match
	for _, u := range result.Items {
		if u.Name == name {
			return u.ID, nil
		}
	}

	return "", nil
}

// processTalk handles a single talk: download files, upload to S3, create content.
func processTalk(client *http.Client, server, category string, talk LegacyTalk, speakerCache map[string]string) error {
	var coverKey string
	var attachments []attachmentCreate

	// Upload cover if present
	if talk.Cover != "" {
		key, err := downloadAndUpload(client, server, talk.Cover, "cover")
		if err != nil {
			log.Printf("  Warning: cover upload failed: %v", err)
			// Continue without cover
		} else {
			coverKey = key
		}
	}

	// Upload playback video if present
	if talk.Playback != "" {
		key, err := downloadAndUpload(client, server, talk.Playback, "video")
		if err != nil {
			return fmt.Errorf("playback upload: %w", err)
		}
		attachments = append(attachments, attachmentCreate{
			URL:       key,
			Type:      "video",
			SortOrder: 0,
		})
	}

	// Build create request
	req := createContentRequest{
		Title:       talk.Title,
		Summary:     talk.Description,
		Body:        talk.Description,
		CoverURL:    coverKey,
		Type:        "video",
		Status:      "published",
		Category:    category,
		Tags:        talk.Tags,
		SpeakerName: talk.Speaker,
		SpeakerBio:  talk.Bio,
		Attachments: attachments,
	}

	if !talk.CreatedAt.IsZero() {
		req.CreatedAt = &talk.CreatedAt
	}

	// Match speaker
	speaker := strings.TrimSpace(talk.Speaker)
	if userID, ok := speakerCache[speaker]; ok {
		req.SpeakerID = userID
		req.SpeakerName = ""
	}

	// Create content via API
	return createContent(client, server, req)
}

// downloadAndUpload downloads a file from sourceURL, gets a presigned URL, and uploads to S3.
// Returns the S3 key (e.g. "uuid.mp4").
func downloadAndUpload(client *http.Client, server, sourceURL, label string) (string, error) {
	// Download the file with streaming
	dlResp, err := http.Get(sourceURL)
	if err != nil {
		return "", fmt.Errorf("download %s: %w", label, err)
	}
	defer dlResp.Body.Close()

	if dlResp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("download %s: status %d", label, dlResp.StatusCode)
	}

	// Determine filename and content type
	filename := filenameFromURL(sourceURL)
	contentType := dlResp.Header.Get("Content-Type")
	if contentType == "" || contentType == "application/octet-stream" {
		contentType = mime.TypeByExtension(filepath.Ext(filename))
		if contentType == "" {
			contentType = "application/octet-stream"
		}
	}

	// Read file into memory (needed for presigned PUT which requires Content-Length)
	data, err := io.ReadAll(dlResp.Body)
	if err != nil {
		return "", fmt.Errorf("read %s body: %w", label, err)
	}

	// Get presigned URL
	presign, err := getPresignedURL(client, server, filename, contentType)
	if err != nil {
		return "", fmt.Errorf("presign %s: %w", label, err)
	}

	// Upload to S3
	putReq, err := http.NewRequest(http.MethodPut, presign.PresignedURL, bytes.NewReader(data))
	if err != nil {
		return "", fmt.Errorf("create PUT request: %w", err)
	}
	putReq.Header.Set("Content-Type", contentType)

	putResp, err := http.DefaultClient.Do(putReq)
	if err != nil {
		return "", fmt.Errorf("upload %s to S3: %w", label, err)
	}
	defer putResp.Body.Close()

	if putResp.StatusCode != http.StatusOK && putResp.StatusCode != http.StatusNoContent {
		b, _ := io.ReadAll(putResp.Body)
		return "", fmt.Errorf("upload %s to S3: status %d: %s", label, putResp.StatusCode, string(b))
	}

	return presign.Key, nil
}

// getPresignedURL requests a presigned upload URL from the platform.
func getPresignedURL(client *http.Client, server, filename, contentType string) (*presignResponse, error) {
	body, _ := json.Marshal(map[string]string{
		"filename":     filename,
		"content_type": contentType,
	})

	resp, err := client.Post(server+"/api/v1/upload/presign", "application/json", bytes.NewReader(body))
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		b, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("status %d: %s", resp.StatusCode, string(b))
	}

	var result presignResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, err
	}

	return &result, nil
}

// createContent calls the platform API to create a content record.
func createContent(client *http.Client, server string, req createContentRequest) error {
	body, err := json.Marshal(req)
	if err != nil {
		return fmt.Errorf("marshal request: %w", err)
	}

	resp, err := client.Post(server+"/api/v1/contents", "application/json", bytes.NewReader(body))
	if err != nil {
		return fmt.Errorf("request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		b, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("status %d: %s", resp.StatusCode, string(b))
	}

	return nil
}

// filenameFromURL extracts a filename from a URL, stripping query parameters.
func filenameFromURL(rawURL string) string {
	u, err := url.Parse(rawURL)
	if err != nil {
		return "file"
	}
	base := filepath.Base(u.Path)
	if base == "" || base == "." || base == "/" {
		return "file"
	}
	return base
}

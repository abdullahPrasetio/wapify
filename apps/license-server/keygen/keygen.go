package keygen

import (
	"crypto/ed25519"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"os"
	"time"
)

type payload struct {
	ClientName string `json:"client_name"`
	Email      string `json:"email"`
	ValidUntil string `json:"valid_until"`
}

// Generate signs a license payload with the private key from LICENSE_PRIVATE_KEY env.
// It returns the license key string in the same format as backend/cmd/license/main.go:
//
//	base64(payloadJSON).base64(signature)
// Generate creates an Ed25519 signed license key.
// duration: "1month" | "1year" | "lifetime" — empty falls back to LICENSE_DURATION env, then "1year".
func Generate(name, email, duration string) (string, time.Time, error) {
	privKeyStr := os.Getenv("LICENSE_PRIVATE_KEY")
	if privKeyStr == "" {
		return "", time.Time{}, fmt.Errorf("LICENSE_PRIVATE_KEY is not set")
	}

	privKeyBytes, err := base64.StdEncoding.DecodeString(privKeyStr)
	if err != nil || len(privKeyBytes) != ed25519.PrivateKeySize {
		return "", time.Time{}, fmt.Errorf("invalid LICENSE_PRIVATE_KEY: %v", err)
	}

	if duration == "" {
		duration = os.Getenv("LICENSE_DURATION")
	}
	if duration == "" {
		duration = "1year"
	}

	var validUntil time.Time
	switch duration {
	case "1month":
		validUntil = time.Now().AddDate(0, 1, 0)
	case "lifetime":
		validUntil = time.Now().AddDate(100, 0, 0)
	default: // 1year
		validUntil = time.Now().AddDate(1, 0, 0)
	}

	p := payload{
		ClientName: name,
		Email:      email,
		ValidUntil: validUntil.Format(time.RFC3339),
	}

	payloadJSON, _ := json.Marshal(p)
	sig := ed25519.Sign(ed25519.PrivateKey(privKeyBytes), payloadJSON)

	key := fmt.Sprintf("%s.%s",
		base64.StdEncoding.EncodeToString(payloadJSON),
		base64.StdEncoding.EncodeToString(sig),
	)

	return key, validUntil, nil
}

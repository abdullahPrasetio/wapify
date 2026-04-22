package main

import (
	"crypto/ed25519"
	"encoding/base64"
	"encoding/json"
	"flag"
	"fmt"
	"log"
	"os"
	"time"

	"github.com/joho/godotenv"
	"github.com/waluyo/wapify-backend/internal/license"
)

func main() {
	// Load .env if exists to get default LICENSE_PRIVATE_KEY
	_ = godotenv.Load()

	if len(os.Args) < 2 {
		printUsage()
		os.Exit(1)
	}

	switch os.Args[1] {
	case "keygen":
		generateKeypair()
	case "generate":
		generateLicense()
	default:
		printUsage()
		os.Exit(1)
	}
}

func printUsage() {
	fmt.Println("Wapify License CLI Usage:")
	fmt.Println("  keygen                          - Generate a new Ed25519 keypair")
	fmt.Println("  generate [flags]                - Generate a new signed license key")
	fmt.Println("\nFlags for generate:")
	fmt.Println("  --name string                   - Client/Organization name")
	fmt.Println("  --email string                  - Client contact email")
	fmt.Println("  --duration string               - 1month, 1year, or lifetime (default: 1year)")
	fmt.Println("  --private-key string            - Private key in Base64 (default: LICENSE_PRIVATE_KEY from .env)")
}

func generateKeypair() {
	pub, priv, err := ed25519.GenerateKey(nil)
	if err != nil {
		log.Fatalf("Failed to generate keypair: %v", err)
	}

	fmt.Println("=== Wapify Keypair Generated ===")
	fmt.Printf("LICENSE_PRIVATE_KEY=%s\n", base64.StdEncoding.EncodeToString(priv))
	fmt.Printf("LICENSE_PUBLIC_KEY=%s\n", base64.StdEncoding.EncodeToString(pub))
	fmt.Println("================================")
	fmt.Println("Keep the PRIVATE_KEY secret. The PUBLIC_KEY should be embedded in the client binary.")
}

func generateLicense() {
	genCmd := flag.NewFlagSet("generate", flag.ExitOnError)
	name := genCmd.String("name", "", "Client name")
	email := genCmd.String("email", "", "Client email")
	duration := genCmd.String("duration", "1year", "1month, 1year, lifetime")
	privKeyFlag := genCmd.String("private-key", "", "Private key Base64")

	genCmd.Parse(os.Args[2:])

	if *name == "" || *email == "" {
		fmt.Println("Error: --name and --email are required")
		genCmd.PrintDefaults()
		os.Exit(1)
	}

	// Determine Private Key
	privKeyStr := *privKeyFlag
	if privKeyStr == "" {
		privKeyStr = os.Getenv("LICENSE_PRIVATE_KEY")
	}

	if privKeyStr == "" {
		log.Fatal("Error: License private key is not provided (use --private-key or set LICENSE_PRIVATE_KEY in .env)")
	}

	privKeyBytes, err := base64.StdEncoding.DecodeString(privKeyStr)
	if err != nil || len(privKeyBytes) != ed25519.PrivateKeySize {
		log.Fatalf("Error: Invalid private key format or size: %v", err)
	}

	privKey := ed25519.PrivateKey(privKeyBytes)

	// Determine Expiry
	var validUntil time.Time
	switch *duration {
	case "3minutes":
		validUntil = time.Now().Add(3 * time.Minute)
	case "5minutes":
		validUntil = time.Now().Add(5 * time.Minute)
	case "10minutes":
		validUntil = time.Now().Add(10 * time.Minute)
	case "1month":
		validUntil = time.Now().AddDate(0, 1, 0)
	case "1year":
		validUntil = time.Now().AddDate(1, 0, 0)
	case "lifetime":
		validUntil = time.Now().AddDate(100, 0, 0)
	default:
		log.Fatalf("Error: Invalid duration '%s'. Use 1month, 1year, or lifetime.", *duration)
	}

	payload := license.LicensePayload{
		ClientName: *name,
		Email:      *email,
		ValidUntil: validUntil.Format(time.RFC3339),
	}

	payloadJSON, _ := json.Marshal(payload)
	signature := ed25519.Sign(privKey, payloadJSON)

	licenseKey := fmt.Sprintf("%s.%s",
		base64.StdEncoding.EncodeToString(payloadJSON),
		base64.StdEncoding.EncodeToString(signature),
	)

	fmt.Println("=== License Generated Successfully ===")
	fmt.Printf("Client:      %s\n", *name)
	fmt.Printf("Email:       %s\n", *email)
	fmt.Printf("Valid Until: %s\n", validUntil.Format("2006-01-02"))
	fmt.Println("--------------------------------------")
	fmt.Printf("LICENSE_KEY:\n%s\n", licenseKey)
	fmt.Println("======================================")
}

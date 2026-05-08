package main

import (
	"crypto/ed25519"
	"encoding/base64"
	"encoding/json"
	"errors"
	"flag"
	"fmt"
	"io"
	"os"
	"time"

	"github.com/joho/godotenv"
	"github.com/waluyo/wapbolt-backend/internal/license"
)

func main() {
	if err := Run(os.Args, os.Stdout); err != nil {
		fmt.Fprintf(os.Stderr, "Error: %v\n", err)
		os.Exit(1)
	}
}

func Run(args []string, out io.Writer) error {
	// Load .env if exists (unless in test)
	if os.Getenv("GO_ENV") != "test" {
		_ = godotenv.Load()
		_ = godotenv.Load(".env")
		_ = godotenv.Load("../../.env")
	}

	if len(args) < 2 {
		printUsage(out)
		return errors.New("missing command")
	}

	switch args[1] {
	case "keygen":
		return generateKeypair(out)
	case "generate":
		return generateLicense(args[2:], out)
	default:
		printUsage(out)
		return fmt.Errorf("unknown command: %s", args[1])
	}
}

func printUsage(out io.Writer) {
	fmt.Fprintln(out, "Wapbolt License CLI Usage:")
	fmt.Fprintln(out, "  keygen                          - Generate a new Ed25519 keypair")
	fmt.Fprintln(out, "  generate [flags]                - Generate a new signed license key")
	fmt.Fprintln(out, "\nFlags for generate:")
	fmt.Fprintln(out, "  --name string                   - Client/Organization name")
	fmt.Fprintln(out, "  --email string                  - Client contact email")
	fmt.Fprintln(out, "  --duration string               - 1month, 1year, or lifetime (default: 1year)")
	fmt.Fprintln(out, "  --private-key string            - Private key in Base64 (default: LICENSE_PRIVATE_KEY from .env)")
}

func generateKeypair(out io.Writer) error {
	pub, priv, err := ed25519.GenerateKey(nil)
	if err != nil {
		return fmt.Errorf("failed to generate keypair: %v", err)
	}

	fmt.Fprintln(out, "=== Wapbolt Keypair Generated ===")
	fmt.Fprintf(out, "LICENSE_PRIVATE_KEY=%s\n", base64.StdEncoding.EncodeToString(priv))
	fmt.Fprintf(out, "LICENSE_PUBLIC_KEY=%s\n", base64.StdEncoding.EncodeToString(pub))
	fmt.Fprintln(out, "================================")
	fmt.Fprintln(out, "Keep the PRIVATE_KEY secret. The PUBLIC_KEY should be embedded in the client binary.")
	return nil
}

func generateLicense(args []string, out io.Writer) error {
	genCmd := flag.NewFlagSet("generate", flag.ContinueOnError)
	genCmd.SetOutput(out)
	name := genCmd.String("name", "", "Client name")
	email := genCmd.String("email", "", "Client email")
	duration := genCmd.String("duration", "1year", "1month, 1year, lifetime")
	privKeyFlag := genCmd.String("private-key", "", "Private key Base64")

	if err := genCmd.Parse(args); err != nil {
		return err
	}

	if *name == "" || *email == "" {
		fmt.Fprintln(out, "Error: --name and --email are required")
		genCmd.Usage()
		return errors.New("missing required flags")
	}

	// Determine Private Key
	privKeyStr := *privKeyFlag
	if privKeyStr == "" {
		privKeyStr = os.Getenv("LICENSE_PRIVATE_KEY")
	}

	if privKeyStr == "" {
		return errors.New("Error: License private key is not provided (use --private-key or set LICENSE_PRIVATE_KEY in .env)")
	}

	privKeyBytes, err := base64.StdEncoding.DecodeString(privKeyStr)
	if err != nil || len(privKeyBytes) != ed25519.PrivateKeySize {
		return fmt.Errorf("Error: Invalid private key format or size: %v", err)
	}

	privKey := ed25519.PrivateKey(privKeyBytes)

	// Determine Expiry
	var validUntil time.Time
	switch *duration {
	case "1minute", "1minutes":
		validUntil = time.Now().Add(1 * time.Minute)
	case "3minute", "3minutes":
		validUntil = time.Now().Add(3 * time.Minute)
	case "5minute", "5minutes":
		validUntil = time.Now().Add(5 * time.Minute)
	case "10minute", "10minutes":
		validUntil = time.Now().Add(10 * time.Minute)
	case "1month":
		validUntil = time.Now().AddDate(0, 1, 0)
	case "1year":
		validUntil = time.Now().AddDate(1, 0, 0)
	case "lifetime":
		validUntil = time.Now().AddDate(100, 0, 0)
	default:
		return fmt.Errorf("Error: Invalid duration '%s'. Use 1month, 1year, or lifetime.", *duration)
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

	fmt.Fprintln(out, "=== License Generated Successfully ===")
	fmt.Fprintf(out, "Client:      %s\n", *name)
	fmt.Fprintf(out, "Email:       %s\n", *email)
	fmt.Fprintf(out, "Valid Until: %s\n", validUntil.Format("2006-01-02"))
	fmt.Fprintln(out, "--------------------------------------")
	fmt.Fprintf(out, "LICENSE_KEY:\n%s\n", licenseKey)
	fmt.Fprintln(out, "======================================")
	return nil
}

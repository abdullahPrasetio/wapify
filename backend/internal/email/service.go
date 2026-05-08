package email

import (
	"fmt"
	"os"

	"github.com/resend/resend-go/v2"
	"github.com/rs/zerolog/log"
)

func SendWelcomeEmail(toEmail, name, password string) error {
	apiKey := os.Getenv("RESEND_API_KEY")
	if apiKey == "" || apiKey == "re_placeholder_key" {
		log.Warn().Msg("RESEND_API_KEY is not set, skipping email")
		return nil
	}

	client := resend.NewClient(apiKey)

	htmlContent := fmt.Sprintf(`
		<h1>Welcome to Wapbolt, %s!</h1>
		<p>Your account has been created by the administrator.</p>
		<p><strong>Login Credentials:</strong></p>
		<ul>
			<li>Email: %s</li>
			<li>Password: %s</li>
		</ul>
		<p>Please change your password after logging in.</p>
		<br/>
		<p>Best regards,<br/>Wapbolt Team</p>
	`, name, toEmail, password)

	params := &resend.SendEmailRequest{
		From:    "Wapbolt <noreply@wapbolt.io>",
		To:      []string{toEmail},
		Subject: "Welcome to Wapbolt - Your Account Credentials",
		Html:    htmlContent,
	}

	sent, err := client.Emails.Send(params)
	if err != nil {
		log.Error().Err(err).Msg("Failed to send welcome email via Resend")
		return err
	}

	log.Info().Str("email", toEmail).Str("id", sent.Id).Msg("Welcome email sent successfully")
	return nil
}

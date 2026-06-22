package mailer

import (
	"crypto/tls"
	"fmt"
	"net"
	"net/smtp"
	"os"
	"strings"
	"time"

	"github.com/rs/zerolog/log"
)

func gmailConfig() (user, pass string, ok bool) {
	user = os.Getenv("GMAIL_USER")
	pass = os.Getenv("GMAIL_APP_PASSWORD")
	return user, pass, user != "" && pass != "" && pass != "xxxx xxxx xxxx xxxx"
}

// sendGmail uses port 465 (SSL/TLS) which is more widely accessible than 587 (STARTTLS).
func sendGmail(to []string, subject, htmlBody string) error {
	user, pass, ok := gmailConfig()
	if !ok {
		return fmt.Errorf("GMAIL_USER or GMAIL_APP_PASSWORD not configured")
	}

	tlsCfg := &tls.Config{ServerName: "smtp.gmail.com"}
	conn, err := tls.Dial("tcp", "smtp.gmail.com:465", tlsCfg)
	if err != nil {
		return fmt.Errorf("dial smtp.gmail.com:465: %w", err)
	}
	defer conn.Close()

	host, _, _ := net.SplitHostPort("smtp.gmail.com:465")
	c, err := smtp.NewClient(conn, host)
	if err != nil {
		return fmt.Errorf("smtp client: %w", err)
	}
	defer c.Quit()

	if err = c.Auth(smtp.PlainAuth("", user, pass, "smtp.gmail.com")); err != nil {
		return fmt.Errorf("smtp auth: %w", err)
	}

	if err = c.Mail(user); err != nil {
		return err
	}
	for _, addr := range to {
		if err = c.Rcpt(addr); err != nil {
			return err
		}
	}

	w, err := c.Data()
	if err != nil {
		return err
	}

	msg := "MIME-Version: 1.0\r\n" +
		"Content-Type: text/html; charset=\"UTF-8\"\r\n" +
		"From: " + user + "\r\n" +
		"To: " + strings.Join(to, ",") + "\r\n" +
		"Subject: " + subject + "\r\n\r\n" +
		htmlBody

	if _, err = fmt.Fprint(w, msg); err != nil {
		return err
	}
	return w.Close()
}

func licenseEmailHTML(name, licenseKey string, validUntil time.Time) string {
	adminEmail := os.Getenv("ADMIN_EMAIL")
	return fmt.Sprintf(`<!DOCTYPE html>
<html>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#0f1117;color:#e2e8f0;padding:40px 0;margin:0">
  <div style="max-width:600px;margin:0 auto;background:#161b27;border-radius:16px;overflow:hidden;border:1px solid #2a3348">
    <div style="background:linear-gradient(135deg,#6c63ff,#7c3aed);padding:32px;text-align:center">
      <div style="font-size:32px;font-weight:800;color:#fff;letter-spacing:-1px">Wapbolt</div>
      <div style="color:rgba(255,255,255,.7);font-size:13px;margin-top:4px">License Key Delivery</div>
    </div>
    <div style="padding:32px">
      <p style="color:#e2e8f0;font-size:16px;margin:0 0 24px">Hi <strong>%s</strong>,</p>
      <p style="color:#8892a4;font-size:14px;margin:0 0 24px">Your Wapbolt license key has been generated successfully. Copy the key below and paste it into the Wapbolt desktop app to activate your installation.</p>

      <div style="background:#0f1117;border:1px solid #2a3348;border-radius:12px;padding:20px;margin:24px 0">
        <div style="font-size:11px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#6c63ff;margin-bottom:12px">Your License Key</div>
        <div style="font-family:'SF Mono','Fira Code',monospace;font-size:12px;color:#a5b4fc;word-break:break-all;line-height:1.6;user-select:all;-webkit-user-select:all">%s</div>
        <div style="font-size:11px;color:#4a5568;margin-top:10px">&#128073; Klik teks di atas lalu Ctrl+A / Cmd+A untuk select semua, kemudian copy.</div>
      </div>

      <div style="background:#1e2535;border-radius:8px;padding:16px;margin:0 0 24px">
        <div style="font-size:13px;color:#8892a4">Valid Until: <strong style="color:#e2e8f0">%s</strong></div>
      </div>

      <p style="color:#8892a4;font-size:13px;line-height:1.6">
        If you have any issues activating your license, reply to this email or contact us at
        <a href="mailto:%s" style="color:#6c63ff">%s</a>.
      </p>
    </div>
    <div style="padding:20px 32px;border-top:1px solid #2a3348;text-align:center;font-size:12px;color:#8892a4">
      Wapbolt &nbsp;·&nbsp; Built for Speed
    </div>
  </div>
</body>
</html>`, name, licenseKey, validUntil.Format("2 January 2006"), adminEmail, adminEmail)
}

// DeliverLicenseKey sends the generated Ed25519 license key directly to the requester.
func DeliverLicenseKey(toEmail, name, licenseKey string, validUntil time.Time) error {
	_, _, ok := gmailConfig()
	if !ok {
		log.Warn().Str("email", toEmail).Msg("GMAIL_USER or GMAIL_APP_PASSWORD not set — license key NOT sent by email")
		return nil
	}

	err := sendGmail(
		[]string{toEmail},
		"Your Wapbolt License Key",
		licenseEmailHTML(name, licenseKey, validUntil),
	)
	if err != nil {
		log.Error().Err(err).Str("email", toEmail).Msg("Failed to deliver license key")
		return err
	}
	log.Info().Str("email", toEmail).Msg("License key delivered via Gmail")
	return nil
}

// NotifyAdmin sends a copy of the issued license to the admin for record-keeping.
func NotifyAdmin(name, email, licenseKey string, validUntil time.Time, id uint) {
	adminEmail := os.Getenv("ADMIN_EMAIL")
	_, _, ok := gmailConfig()
	if !ok || adminEmail == "" {
		log.Warn().Msg("Gmail not configured or ADMIN_EMAIL not set — skipping admin notification")
		return
	}

	html := fmt.Sprintf(`
		<h3>License Issued — Request #%d</h3>
		<ul>
			<li><strong>Name:</strong> %s</li>
			<li><strong>Email:</strong> %s</li>
			<li><strong>Valid Until:</strong> %s</li>
		</ul>
		<p><strong>Key:</strong></p>
		<pre style="background:#f4f4f5;padding:12px;border-radius:8px;font-size:12px;word-break:break-all">%s</pre>
	`, id, name, email, validUntil.Format("2006-01-02"), licenseKey)

	if err := sendGmail(
		[]string{adminEmail},
		fmt.Sprintf("[Wapbolt] License issued to %s", email),
		html,
	); err != nil {
		log.Error().Err(err).Msg("Failed to send admin notification")
		return
	}
	log.Info().Str("admin", adminEmail).Msg("Admin notification sent")
}

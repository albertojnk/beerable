package payment

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"io"
	"net/http"
	"os"

	"github.com/gin-gonic/gin"
	"github.com/jmoiron/sqlx"
)

type QRCodeGenerator interface {
	Generate(orderID string) error
}

type WebhookHandler struct {
	DB          *sqlx.DB
	QRGenerator QRCodeGenerator
}

func (h *WebhookHandler) HandlePagarme(c *gin.Context) {
	body, err := io.ReadAll(c.Request.Body)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "failed to read body"})
		return
	}

	secret := os.Getenv("PAGARME_WEBHOOK_SECRET")
	if secret != "" && secret != "seu_webhook_secret_aqui" {
		sig := c.GetHeader("x-pagarme-signature")
		if !verifyHMAC(body, sig, secret) {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid signature"})
			return
		}
	}

	var event map[string]any
	if err := json.Unmarshal(body, &event); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid json"})
		return
	}

	eventType, _ := event["type"].(string)
	if eventType != "charge.paid" {
		c.JSON(http.StatusOK, gin.H{"status": "ignored"})
		return
	}

	data, _ := event["data"].(map[string]any)
	chargeID, _ := data["id"].(string)
	if chargeID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "missing charge id"})
		return
	}

	var orderID string
	err = h.DB.QueryRow(
		"SELECT id FROM orders WHERE payment_provider_ref=$1 AND status='pending_payment'", chargeID,
	).Scan(&orderID)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"status": "already processed or not found"})
		return
	}

	_, err = h.DB.Exec(
		"UPDATE orders SET status='paid', paid_at=NOW() WHERE id=$1", orderID,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to update order"})
		return
	}

	if h.QRGenerator != nil {
		h.QRGenerator.Generate(orderID)
	}

	c.JSON(http.StatusOK, gin.H{"status": "ok"})
}

func verifyHMAC(body []byte, signature, secret string) bool {
	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write(body)
	expected := hex.EncodeToString(mac.Sum(nil))
	return hmac.Equal([]byte(expected), []byte(signature))
}

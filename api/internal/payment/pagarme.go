package payment

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"time"
)

type Client struct{}

type PixChargeResult struct {
	ChargeID      string    `json:"charge_id"`
	PixQRCode     string    `json:"pix_qr_code"`
	PixExpiration time.Time `json:"pix_expiration"`
}

type pagarmeRequest struct {
	Items    []pagarmeItem    `json:"items"`
	Payments []pagarmePayment `json:"payments"`
}

type pagarmeItem struct {
	Amount      int    `json:"amount"`
	Description string `json:"description"`
	Quantity    int    `json:"quantity"`
	Code        string `json:"code"`
}

type pagarmePayment struct {
	PaymentMethod string     `json:"payment_method"`
	Pix           *pixConfig `json:"pix,omitempty"`
}

type pixConfig struct {
	ExpiresIn int `json:"expires_in"`
}

func (c *Client) CreatePixCharge(orderID string, amount float64, idempotencyKey string) (*PixChargeResult, error) {
	apiKey := os.Getenv("PAGARME_API_KEY")
	if apiKey == "" || apiKey == "sua_chave_sandbox_aqui" {
		return c.mockPixCharge(orderID, amount)
	}

	amountCents := int(amount * 100)
	reqBody := pagarmeRequest{
		Items: []pagarmeItem{
			{Amount: amountCents, Description: "Pedido " + orderID, Quantity: 1, Code: orderID},
		},
		Payments: []pagarmePayment{
			{PaymentMethod: "pix", Pix: &pixConfig{ExpiresIn: 600}},
		},
	}

	body, _ := json.Marshal(reqBody)
	req, _ := http.NewRequest("POST", "https://api.pagar.me/core/v5/orders", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Basic "+apiKey)
	req.Header.Set("Idempotency-Key", idempotencyKey)

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("pagar.me request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		return nil, fmt.Errorf("pagar.me returned status %d", resp.StatusCode)
	}

	var result map[string]any
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("failed to decode pagar.me response: %w", err)
	}

	charges, ok := result["charges"].([]any)
	if !ok || len(charges) == 0 {
		return nil, fmt.Errorf("no charges in pagar.me response")
	}
	charge := charges[0].(map[string]any)
	lastTx, ok := charge["last_transaction"].(map[string]any)
	if !ok {
		return nil, fmt.Errorf("no transaction in pagar.me response")
	}

	qrCode, _ := lastTx["qr_code"].(string)
	chargeID, _ := charge["id"].(string)

	return &PixChargeResult{
		ChargeID:      chargeID,
		PixQRCode:     qrCode,
		PixExpiration: time.Now().Add(10 * time.Minute),
	}, nil
}

func (c *Client) mockPixCharge(orderID string, amount float64) (*PixChargeResult, error) {
	return &PixChargeResult{
		ChargeID:      "mock_charge_" + orderID,
		PixQRCode:     fmt.Sprintf("00020126580014br.gov.bcb.pix0136mock-%s5204000053039865802BR5913BEERABLE6009SAO PAULO62070503***6304MOCK", orderID[:8]),
		PixExpiration: time.Now().Add(10 * time.Minute),
	}, nil
}

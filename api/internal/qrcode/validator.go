package qrcode

import (
	"fmt"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

type ScanResult struct {
	OrderID      string  `json:"order_id"`
	CustomerName string  `json:"customer_name"`
	Total        float64 `json:"total"`
	Items        []struct {
		ProductName string `json:"product_name"`
		Quantity    int    `json:"quantity"`
	} `json:"items"`
}

func (g *Generator) Scan(tokenStr string) (*ScanResult, error) {
	token, err := jwt.Parse(tokenStr, func(t *jwt.Token) (any, error) {
		if _, ok := t.Method.(*jwt.SigningMethodRSA); !ok {
			return nil, fmt.Errorf("unexpected signing method")
		}
		return g.PublicKey, nil
	})
	if err != nil {
		return nil, fmt.Errorf("invalid QR code token")
	}

	claims, ok := token.Claims.(jwt.MapClaims)
	if !ok || !token.Valid {
		return nil, fmt.Errorf("invalid QR code claims")
	}

	tokenType, _ := claims["type"].(string)
	if tokenType != "qrcode" {
		return nil, fmt.Errorf("invalid token type")
	}

	orderID, _ := claims["order_id"].(string)
	if orderID == "" {
		return nil, fmt.Errorf("missing order_id in token")
	}

	var qrID string
	var expiresAt time.Time
	err = g.DB.QueryRow(
		"SELECT id, expires_at FROM qr_codes WHERE order_id=$1 AND is_valid=true", orderID,
	).Scan(&qrID, &expiresAt)
	if err != nil {
		return nil, fmt.Errorf("QR code not found or already used")
	}

	if time.Now().After(expiresAt) {
		return nil, fmt.Errorf("QR code expired")
	}

	tx, err := g.DB.Beginx()
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()

	_, err = tx.Exec("UPDATE qr_codes SET is_valid=false, scanned_at=NOW() WHERE id=$1", qrID)
	if err != nil {
		return nil, err
	}

	_, err = tx.Exec("UPDATE orders SET status='collected', collected_at=NOW() WHERE id=$1", orderID)
	if err != nil {
		return nil, err
	}

	if err := tx.Commit(); err != nil {
		return nil, err
	}

	var result ScanResult
	result.OrderID = orderID

	g.DB.QueryRow("SELECT c.name, o.total FROM orders o JOIN customers c ON o.customer_id=c.id WHERE o.id=$1", orderID).
		Scan(&result.CustomerName, &result.Total)

	rows, _ := g.DB.Query("SELECT product_name, quantity FROM order_items WHERE order_id=$1", orderID)
	if rows != nil {
		defer rows.Close()
		for rows.Next() {
			var item struct {
				ProductName string `json:"product_name"`
				Quantity    int    `json:"quantity"`
			}
			rows.Scan(&item.ProductName, &item.Quantity)
			result.Items = append(result.Items, item)
		}
	}

	return &result, nil
}

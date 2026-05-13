package qrcode

import (
	"crypto/rand"
	"crypto/rsa"
	"crypto/x509"
	"encoding/pem"
	"os"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
)

type Generator struct {
	DB         *sqlx.DB
	PrivateKey *rsa.PrivateKey
	PublicKey  *rsa.PublicKey
	ExpiryH    int
}

func NewGenerator(db *sqlx.DB, expiryHours int) (*Generator, error) {
	keysDir := "keys"
	os.MkdirAll(keysDir, 0700)

	privPath := keysDir + "/private.pem"
	pubPath := keysDir + "/public.pem"

	var privKey *rsa.PrivateKey

	if privBytes, err := os.ReadFile(privPath); err == nil {
		block, _ := pem.Decode(privBytes)
		privKey, _ = x509.ParsePKCS1PrivateKey(block.Bytes)
	}

	if privKey == nil {
		var err error
		privKey, err = rsa.GenerateKey(rand.Reader, 2048)
		if err != nil {
			return nil, err
		}
		privPEM := pem.EncodeToMemory(&pem.Block{
			Type:  "RSA PRIVATE KEY",
			Bytes: x509.MarshalPKCS1PrivateKey(privKey),
		})
		os.WriteFile(privPath, privPEM, 0600)

		pubBytes, _ := x509.MarshalPKIXPublicKey(&privKey.PublicKey)
		pubPEM := pem.EncodeToMemory(&pem.Block{
			Type:  "RSA PUBLIC KEY",
			Bytes: pubBytes,
		})
		os.WriteFile(pubPath, pubPEM, 0644)
	}

	return &Generator{
		DB:         db,
		PrivateKey: privKey,
		PublicKey:  &privKey.PublicKey,
		ExpiryH:    expiryHours,
	}, nil
}

func (g *Generator) Generate(orderID string) error {
	expiry := time.Now().Add(time.Duration(g.ExpiryH) * time.Hour)

	claims := jwt.MapClaims{
		"order_id": orderID,
		"type":     "qrcode",
		"exp":      expiry.Unix(),
		"jti":      uuid.New().String(),
	}

	token := jwt.NewWithClaims(jwt.SigningMethodRS256, claims)
	tokenStr, err := token.SignedString(g.PrivateKey)
	if err != nil {
		return err
	}

	_, err = g.DB.Exec(
		`INSERT INTO qr_codes (order_id, token, expires_at) VALUES ($1, $2, $3)
		 ON CONFLICT (order_id) DO UPDATE SET token=$2, expires_at=$3, is_valid=true, scanned_at=NULL`,
		orderID, tokenStr, expiry,
	)
	return err
}

func (g *Generator) GetToken(orderID string) (string, error) {
	var token string
	err := g.DB.Get(&token,
		"SELECT token FROM qr_codes WHERE order_id=$1 AND is_valid=true AND expires_at > NOW()", orderID)
	return token, err
}


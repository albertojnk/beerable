package main

import (
	"fmt"
	"log"
	"net/http"
	"os"
	"strconv"

	"github.com/beerable/marketplace-mvp/internal/auth"
	"github.com/beerable/marketplace-mvp/internal/catalog"
	"github.com/beerable/marketplace-mvp/internal/order"
	"github.com/beerable/marketplace-mvp/internal/payment"
	"github.com/beerable/marketplace-mvp/internal/qrcode"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"github.com/jmoiron/sqlx"
	"github.com/joho/godotenv"
	_ "github.com/lib/pq"
)

func main() {
	godotenv.Load()

	dbURL := os.Getenv("DB_URL")
	if dbURL == "" {
		log.Fatal("DB_URL is required")
	}

	db, err := sqlx.Connect("postgres", dbURL)
	if err != nil {
		log.Fatalf("failed to connect to database: %v", err)
	}
	defer db.Close()

	runMigrations(db)

	expiryHours := 24
	if v := os.Getenv("QR_EXPIRY_HOURS"); v != "" {
		expiryHours, _ = strconv.Atoi(v)
	}

	qrGen, err := qrcode.NewGenerator(db, expiryHours)
	if err != nil {
		log.Fatalf("failed to init QR code generator: %v", err)
	}

	catalogRepo := &catalog.Repository{DB: db}
	orderRepo := &order.Repository{DB: db}
	paymentClient := &payment.Client{}

	orderService := &order.Service{
		OrderRepo:   orderRepo,
		CatalogRepo: catalogRepo,
		Payment:     paymentClient,
	}

	authHandler := &auth.Handler{DB: db}
	catalogHandler := &catalog.Handler{Repo: catalogRepo}
	orderHandler := &order.Handler{Service: orderService, Repo: orderRepo}
	webhookHandler := &payment.WebhookHandler{DB: db, QRGenerator: qrGen}

	r := gin.Default()
	r.Use(cors.New(cors.Config{
		AllowOrigins:     []string{"*"},
		AllowMethods:     []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"Origin", "Content-Type", "Authorization"},
		AllowCredentials: true,
	}))

	api := r.Group("/api")

	api.POST("/auth/establishment/login", authHandler.EstablishmentLogin)
	api.POST("/auth/customer/register", authHandler.CustomerRegister)
	api.POST("/auth/customer/login", authHandler.CustomerLogin)

	customer := api.Group("")
	customer.Use(auth.RequireCustomer())
	{
		customer.GET("/establishment/:id/menu", catalogHandler.GetMenu)
		customer.POST("/orders", orderHandler.CreateOrder)
		customer.GET("/orders/:id", orderHandler.GetOrder)
		customer.GET("/orders/:id/qrcode", func(c *gin.Context) {
			orderID := c.Param("id")
			token, err := qrGen.GetToken(orderID)
			if err != nil {
				c.JSON(http.StatusNotFound, gin.H{"error": "QR code not available yet"})
				return
			}
			c.JSON(http.StatusOK, gin.H{"token": token})
		})
		customer.GET("/orders/my", orderHandler.MyOrders)
	}

	admin := api.Group("/admin")
	admin.Use(auth.RequireEstablishment())
	{
		admin.GET("/products", catalogHandler.ListProducts)
		admin.POST("/products", catalogHandler.CreateProduct)
		admin.PUT("/products/:id", catalogHandler.UpdateProduct)
		admin.DELETE("/products/:id", catalogHandler.DeleteProduct)

		admin.GET("/categories", catalogHandler.ListCategories)
		admin.POST("/categories", catalogHandler.CreateCategory)

		admin.GET("/orders", orderHandler.ListEstablishmentOrders)
		admin.POST("/qrcode/scan", func(c *gin.Context) {
			var req struct {
				Token string `json:"token" binding:"required"`
			}
			if err := c.ShouldBindJSON(&req); err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"error": "token required"})
				return
			}
			result, err := qrGen.Scan(req.Token)
			if err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
				return
			}
			c.JSON(http.StatusOK, result)
		})
	}

	api.POST("/webhooks/pagarme", webhookHandler.HandlePagarme)

	// Simulate payment endpoint for development
	api.POST("/dev/simulate-payment/:id", func(c *gin.Context) {
		orderID := c.Param("id")
		if err := orderRepo.MarkPaidByID(orderID); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "failed to mark as paid"})
			return
		}
		if err := qrGen.Generate(orderID); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to generate QR code"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"status": "paid", "order_id": orderID})
	})

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}
	log.Printf("Server starting on :%s", port)
	r.Run(fmt.Sprintf(":%s", port))
}

func runMigrations(db *sqlx.DB) {
	files := []string{"migrations/001_mvp.sql", "migrations/002_seed.sql"}
	for _, f := range files {
		migration, err := os.ReadFile(f)
		if err != nil {
			log.Printf("Warning: could not read %s: %v", f, err)
			continue
		}
		_, err = db.Exec(string(migration))
		if err != nil {
			log.Printf("Warning: %s error (may already be applied): %v", f, err)
		} else {
			log.Printf("Applied %s", f)
		}
	}
}

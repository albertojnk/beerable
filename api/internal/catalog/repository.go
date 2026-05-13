package catalog

import (
	"time"

	"github.com/jmoiron/sqlx"
)

type Product struct {
	ID              string    `db:"id" json:"id"`
	EstablishmentID string    `db:"establishment_id" json:"establishment_id"`
	CategoryID      *string   `db:"category_id" json:"category_id"`
	Name            string    `db:"name" json:"name"`
	Description     *string   `db:"description" json:"description"`
	Price           float64   `db:"price" json:"price"`
	ImageURL        *string   `db:"image_url" json:"image_url"`
	IsAvailable     bool      `db:"is_available" json:"is_available"`
	CreatedAt       time.Time `db:"created_at" json:"created_at"`
}

type Category struct {
	ID              string `db:"id" json:"id"`
	EstablishmentID string `db:"establishment_id" json:"establishment_id"`
	Name            string `db:"name" json:"name"`
	SortOrder       int    `db:"sort_order" json:"sort_order"`
}

type Repository struct {
	DB *sqlx.DB
}

func (r *Repository) ListProducts(establishmentID string) ([]Product, error) {
	var products []Product
	err := r.DB.Select(&products,
		"SELECT * FROM products WHERE establishment_id = $1 ORDER BY created_at DESC", establishmentID)
	if err != nil {
		return nil, err
	}
	if products == nil {
		products = []Product{}
	}
	return products, nil
}

func (r *Repository) ListAvailableProducts(establishmentID string) ([]Product, error) {
	var products []Product
	err := r.DB.Select(&products,
		"SELECT * FROM products WHERE establishment_id = $1 AND is_available = true ORDER BY created_at DESC", establishmentID)
	if err != nil {
		return nil, err
	}
	if products == nil {
		products = []Product{}
	}
	return products, nil
}

func (r *Repository) GetProduct(id string) (*Product, error) {
	var p Product
	err := r.DB.Get(&p, "SELECT * FROM products WHERE id = $1", id)
	if err != nil {
		return nil, err
	}
	return &p, nil
}

func (r *Repository) CreateProduct(p *Product) error {
	return r.DB.QueryRow(
		`INSERT INTO products (establishment_id, category_id, name, description, price, image_url, is_available)
		 VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id, created_at`,
		p.EstablishmentID, p.CategoryID, p.Name, p.Description, p.Price, p.ImageURL, p.IsAvailable,
	).Scan(&p.ID, &p.CreatedAt)
}

func (r *Repository) UpdateProduct(p *Product) error {
	_, err := r.DB.Exec(
		`UPDATE products SET name=$1, description=$2, price=$3, image_url=$4, is_available=$5, category_id=$6
		 WHERE id=$7 AND establishment_id=$8`,
		p.Name, p.Description, p.Price, p.ImageURL, p.IsAvailable, p.CategoryID, p.ID, p.EstablishmentID,
	)
	return err
}

func (r *Repository) DeleteProduct(id, establishmentID string) error {
	_, err := r.DB.Exec("DELETE FROM products WHERE id=$1 AND establishment_id=$2", id, establishmentID)
	return err
}

func (r *Repository) ListCategories(establishmentID string) ([]Category, error) {
	var categories []Category
	err := r.DB.Select(&categories,
		"SELECT * FROM categories WHERE establishment_id = $1 ORDER BY sort_order ASC", establishmentID)
	if err != nil {
		return nil, err
	}
	if categories == nil {
		categories = []Category{}
	}
	return categories, nil
}

func (r *Repository) CreateCategory(cat *Category) error {
	return r.DB.QueryRow(
		"INSERT INTO categories (establishment_id, name, sort_order) VALUES ($1, $2, $3) RETURNING id",
		cat.EstablishmentID, cat.Name, cat.SortOrder,
	).Scan(&cat.ID)
}

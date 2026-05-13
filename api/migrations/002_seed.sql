-- Seed: default establishment (password: admin123)
INSERT INTO establishments (id, name, owner_email, owner_password_hash, pix_key)
VALUES (
    '00000000-0000-0000-0000-000000000001',
    'Bar do Zé',
    'admin@beerable.com',
    '$2a$10$jhK2yKoV75AET3YSAfQnWehBewkJzZb7Iqp6Kl.dhm8eBX0YeID5S',
    'pix@beerable.com'
) ON CONFLICT (id) DO NOTHING;

-- Seed: sample categories
INSERT INTO categories (id, establishment_id, name, sort_order) VALUES
    ('c0000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'Cervejas', 1),
    ('c0000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'Petiscos', 2),
    ('c0000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', 'Drinks', 3)
ON CONFLICT (id) DO NOTHING;

-- Seed: sample products
INSERT INTO products (establishment_id, category_id, name, description, price, is_available) VALUES
    ('00000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'Brahma 600ml', 'Cerveja Brahma garrafa', 12.90, true),
    ('00000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'IPA Artesanal', 'IPA local 350ml', 18.50, true),
    ('00000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'Heineken Long Neck', 'Heineken 330ml', 14.00, true),
    ('00000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000002', 'Porção de Batata Frita', 'Batata frita crocante', 25.00, true),
    ('00000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000002', 'Tábua de Frios', 'Queijos e embutidos variados', 45.00, true),
    ('00000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000003', 'Caipirinha de Limão', 'Cachaça, limão e açúcar', 16.00, true),
    ('00000000-0000-0000-0000-000000000003', 'c0000000-0000-0000-0000-000000000003', 'Gin Tônica', 'Gin, tônica e limão', 22.00, true)
ON CONFLICT DO NOTHING;

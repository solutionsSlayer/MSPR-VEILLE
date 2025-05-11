-- Add initial RSS feed sources
INSERT INTO rss.feeds (title, url, description, language, category, active) VALUES
('arXiv Quantum Physics', 'http://export.arxiv.org/rss/quant-ph', 'Quantum Physics updates on arXiv.org', 'en', 'Quantum Physics', true),
('Phys.org Quantum Physics', 'https://phys.org/rss-feed/quantum-physics-news/', 'Latest news on quantum physics from Phys.org', 'en', 'Quantum Physics', true),
('Science Daily Quantum Computers', 'https://www.sciencedaily.com/rss/computers_math/quantum_computers.xml', 'Quantum Computers News', 'en', 'Quantum Computing', true),
('Nature Quantum Information', 'https://www.nature.com/npjqi.rss', 'NPJ Quantum Information journal feed', 'en', 'Quantum Information', true),
('Quanta Magazine', 'https://api.quantamagazine.org/feed/', 'Quanta Magazine science news', 'en', 'Science', true),
('MIT Technology Review', 'https://www.technologyreview.com/feed/', 'MIT Technology Review', 'en', 'Technology', true)
ON CONFLICT (url) DO NOTHING;

-- Add sample users if you have user management
-- INSERT INTO users (username, email, password_hash, role) VALUES
-- ('admin', 'admin@example.com', '$2b$10$...', 'admin')
-- ON CONFLICT (username) DO NOTHING;

-- Run a VACUUM ANALYZE to update statistics
ANALYZE rss.feeds;

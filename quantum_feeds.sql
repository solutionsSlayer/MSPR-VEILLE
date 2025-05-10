-- Script d'ajout de flux RSS sur la cryptographie quantique
-- Nettoyer les données existantes (décommenter si besoin)
-- TRUNCATE rss.podcasts CASCADE;
-- TRUNCATE rss.summaries CASCADE;
-- TRUNCATE rss.items CASCADE;
-- TRUNCATE rss.feeds CASCADE;

-- Ajouter des flux RSS spécifiques à la cryptographie quantique
INSERT INTO rss.feeds (title, url, description, language, category, active)
SELECT 'NIST Quantum', 'https://www.nist.gov/news-events/quantum-information-science/rss.xml', 'National Institute of Standards and Technology - Quantum Information Science news', 'en', 'Quantum Cryptography', true
WHERE NOT EXISTS (SELECT 1 FROM rss.feeds WHERE url = 'https://www.nist.gov/news-events/quantum-information-science/rss.xml');

INSERT INTO rss.feeds (title, url, description, language, category, active)
SELECT 'Quantum Computing Report', 'https://quantumcomputingreport.com/feed/', 'News and analysis on the quantum computing industry including quantum cryptography', 'en', 'Quantum Computing', true
WHERE NOT EXISTS (SELECT 1 FROM rss.feeds WHERE url = 'https://quantumcomputingreport.com/feed/');

INSERT INTO rss.feeds (title, url, description, language, category, active)
SELECT 'Quantum Resistant Cryptography', 'https://medium.com/feed/tag/quantum-cryptography', 'Medium articles tagged with quantum cryptography', 'en', 'Post-Quantum Cryptography', true
WHERE NOT EXISTS (SELECT 1 FROM rss.feeds WHERE url = 'https://medium.com/feed/tag/quantum-cryptography');

INSERT INTO rss.feeds (title, url, description, language, category, active)
SELECT 'Post-Quantum Cryptography Standardization', 'https://csrc.nist.gov/projects/post-quantum-cryptography.rss', 'NIST Post-Quantum Cryptography Standardization updates', 'en', 'Post-Quantum Cryptography', true
WHERE NOT EXISTS (SELECT 1 FROM rss.feeds WHERE url = 'https://csrc.nist.gov/projects/post-quantum-cryptography.rss');

INSERT INTO rss.feeds (title, url, description, language, category, active)
SELECT 'Arxiv Quantum Cryptography', 'http://export.arxiv.org/rss/quant-ph?query=cat:quant-ph+AND+%28cryptography%29', 'Recent academic papers on quantum cryptography from arXiv', 'en', 'Academic Research', true
WHERE NOT EXISTS (SELECT 1 FROM rss.feeds WHERE url = 'http://export.arxiv.org/rss/quant-ph?query=cat:quant-ph+AND+%28cryptography%29');

-- Afficher les flux ajoutés
SELECT id, title, url, category FROM rss.feeds; 
-- Add some sample RSS feeds if the table is empty
INSERT INTO rss.feeds (title, url, description, language, category, active)
SELECT 'Phys.org Quantum Physics', 'https://phys.org/rss-feed/quantum-physics-news/', 'Latest news on quantum physics from Phys.org', 'en', 'Quantum Physics', true
WHERE NOT EXISTS (SELECT 1 FROM rss.feeds WHERE url = 'https://phys.org/rss-feed/quantum-physics-news/');

INSERT INTO rss.feeds (title, url, description, language, category, active)
SELECT 'Quantum Computing Report', 'https://quantumcomputingreport.com/feed/', 'News and analysis on the quantum computing industry', 'en', 'Quantum Computing', true
WHERE NOT EXISTS (SELECT 1 FROM rss.feeds WHERE url = 'https://quantumcomputingreport.com/feed/');

INSERT INTO rss.feeds (title, url, description, language, category, active)
SELECT 'Nature Quantum Information', 'https://www.nature.com/npjqi.rss', 'Nature Partner Journal for Quantum Information', 'en', 'Research', true
WHERE NOT EXISTS (SELECT 1 FROM rss.feeds WHERE url = 'https://www.nature.com/npjqi.rss');

-- Example of a French feed (if relevant)
-- INSERT INTO rss.feeds (title, url, description, language, category, active)
-- SELECT 'Le Monde Informatique - Quantique', 'https://www.lemondeinformatique.fr/flux-rss/thematique/quantique/rss.xml', 'Actualités sur l informatique quantique', 'fr', 'Quantum Computing', true
-- WHERE NOT EXISTS (SELECT 1 FROM rss.feeds WHERE url = 'https://www.lemondeinformatique.fr/flux-rss/thematique/quantique/rss.xml');

-- Flux RSS spécifiques à la cryptographie quantique
INSERT INTO rss.feeds (title, url, description, language, category, active)
SELECT 'NIST Quantum', 'https://www.nist.gov/news-events/quantum-information-science/rss.xml', 'National Institute of Standards and Technology - Quantum Information Science news', 'en', 'Quantum Cryptography', true
WHERE NOT EXISTS (SELECT 1 FROM rss.feeds WHERE url = 'https://www.nist.gov/news-events/quantum-information-science/rss.xml');

INSERT INTO rss.feeds (title, url, description, language, category, active)
SELECT 'Quantum Resistant Cryptography', 'https://medium.com/feed/tag/quantum-cryptography', 'Medium articles tagged with quantum cryptography', 'en', 'Post-Quantum Cryptography', true
WHERE NOT EXISTS (SELECT 1 FROM rss.feeds WHERE url = 'https://medium.com/feed/tag/quantum-cryptography');

INSERT INTO rss.feeds (title, url, description, language, category, active)
SELECT 'Post-Quantum Cryptography Standardization', 'https://csrc.nist.gov/projects/post-quantum-cryptography.rss', 'NIST Post-Quantum Cryptography Standardization updates', 'en', 'Post-Quantum Cryptography', true
WHERE NOT EXISTS (SELECT 1 FROM rss.feeds WHERE url = 'https://csrc.nist.gov/projects/post-quantum-cryptography.rss');

INSERT INTO rss.feeds (title, url, description, language, category, active)
SELECT 'Arxiv Quantum Cryptography', 'http://export.arxiv.org/rss/quant-ph?query=cat:quant-ph+AND+%28cryptography%29', 'Recent academic papers on quantum cryptography from arXiv', 'en', 'Academic Research', true
WHERE NOT EXISTS (SELECT 1 FROM rss.feeds WHERE url = 'http://export.arxiv.org/rss/quant-ph?query=cat:quant-ph+AND+%28cryptography%29');


-- Insert sample RSS feeds related to technology and AI
INSERT INTO rss.feeds (title, url, description, language, category)
VALUES 
    ('TechCrunch', 'https://techcrunch.com/feed/', 'Technology news and analysis', 'en', 'Technology'),
    ('Wired', 'https://www.wired.com/feed/rss', 'Latest technology news and trends', 'en', 'Technology'),
    ('MIT Technology Review', 'https://www.technologyreview.com/feed/', 'Technology news from MIT', 'en', 'Technology'),
    ('ArXiv AI', 'http://arxiv.org/rss/cs.AI', 'ArXiv AI research papers', 'en', 'AI Research'),
    ('AI Trends', 'https://aitrends.com/feed/', 'AI news and trends', 'en', 'Artificial Intelligence'),
    ('Google AI Blog', 'http://feeds.feedburner.com/blogspot/gJZg', 'Google AI research and announcements', 'en', 'Artificial Intelligence'),
    ('Le Monde Informatique', 'https://www.lemondeinformatique.fr/flux-rss/thematique/toutes-les-actualites/rss.xml', 'Actualités informatiques en français', 'fr', 'Technology'),
    ('Futura Tech', 'https://www.futura-sciences.com/rss/tech/actualites.xml', 'Actualités technologies en français', 'fr', 'Technology'),
    ('Journal du Net', 'https://www.journaldunet.com/rss/', 'Actualités technologiques et business', 'fr', 'Technology'),
    ('The Verge', 'https://www.theverge.com/rss/index.xml', 'Technology, science, and culture news', 'en', 'Technology');

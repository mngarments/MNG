-- ============================================================================
-- MN Garments — seed data
-- Run AFTER 0001_init.sql. Safe to re-run (idempotent upserts).
-- Everything below is editable from the /admin CRM afterwards.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Global settings (brand identity, contact, WhatsApp, SEO)
-- ---------------------------------------------------------------------------
insert into site_settings (key, value) values
  ('brand_name',       '"MN Garments"'::jsonb),
  ('brand_tagline',    '"Master Apparel Distributor · Ranchi"'::jsonb),
  ('whatsapp_number',  '"919000000000"'::jsonb),
  ('whatsapp_label',   '"Sales Desk"'::jsonb),
  ('sales_email',      '"sales@mngarments.com"'::jsonb),
  ('phone',            '"+91 90000 00000"'::jsonb),
  ('address',          '"Upper Bazar, Ranchi, Jharkhand 834001"'::jsonb),
  ('seo_title',        '"MN Garments — Master Apparel Distributor, Ranchi"'::jsonb),
  ('seo_description',  '"Master Distributor for Van Heusen Athleisure, Twills, Brizzle, Status Quo & Mudo Jeans. Wholesale, ready stock, Ranchi (Jharkhand)."'::jsonb)
on conflict (key) do nothing;

-- ---------------------------------------------------------------------------
-- Section content blocks
-- ---------------------------------------------------------------------------
insert into site_sections (key, title, data, sort_order) values
  ('hero', 'Hero',
    jsonb_build_object(
      'eyebrow', 'Master Distributor · Est. Ranchi',
      'headline', 'Premium menswear & athleisure, distributed at scale.',
      'subheadline', 'MN Garments is the master distributor for Van Heusen Athleisure and India''s leading menswear brands across Jharkhand — ready stock, dealer-net pricing, and dependable fulfilment.',
      'primary_cta_label', 'Browse Lookbook',
      'primary_cta_href', '#lookbook',
      'secondary_cta_label', 'Talk to Sales',
      'secondary_cta_href', '#contact'
    ), 0),
  ('credentials', 'Wholesale Credentials',
    jsonb_build_object(
      'items', jsonb_build_array(
        jsonb_build_object('value', '5+', 'label', 'Marquee Brands'),
        jsonb_build_object('value', '500+', 'label', 'Retail Partners'),
        jsonb_build_object('value', 'Ready', 'label', 'Stock Availability'),
        jsonb_build_object('value', 'Ranchi', 'label', 'C&F Hub, Jharkhand')
      )
    ), 1),
  ('brands_intro', 'Brand Portfolio',
    jsonb_build_object(
      'heading', 'Brand Portfolio',
      'subheading', 'Authorised distribution across premium menswear and athleisure labels.'
    ), 2),
  ('sisters_intro', 'Sister Companies',
    jsonb_build_object(
      'heading', 'Our Group of Companies',
      'subheading', 'A vertically integrated apparel group spanning wholesale, retail and kidswear.'
    ), 3),
  ('lookbook_intro', 'Retailer Lookbook',
    jsonb_build_object(
      'heading', 'Retailer Lookbook',
      'subheading', 'Live articles with dealer-net rates. Order in one tap on WhatsApp.'
    ), 4),
  ('footer', 'Footer',
    jsonb_build_object(
      'note', 'MN Garments — Master Apparel Distributor. All prices are indicative dealer-net and exclusive of applicable GST.'
    ), 5)
on conflict (key) do nothing;

-- ---------------------------------------------------------------------------
-- Brand portfolio
-- ---------------------------------------------------------------------------
insert into brands (name, tagline, description, is_ready_stock, sort_order) values
  ('Van Heusen Athleisure', 'Signature comfort wear', 'Premium innerwear, activewear and athleisure — the flagship distribution line.', true, 0),
  ('Twills', 'Everyday premium', 'Smart-casual menswear built for daily wear and repeat retail demand.', true, 1),
  ('Brizzle', 'Cool & contemporary', 'Trend-forward casuals for the young menswear shopper.', true, 2),
  ('Status Quo', 'Statement menswear', 'Fashion-led tees and casuals with strong sell-through.', true, 3),
  ('Mudo Jeans', 'Denim, done right', 'Full-range denim and bottoms across the size curve.', true, 4)
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- Sister companies
-- ---------------------------------------------------------------------------
insert into sister_companies (name, role, description, location, sort_order) values
  ('M Nirmal Kumar Private Limited', 'Corporate Wholesale & C&F', 'The corporate wholesale and carrying-and-forwarding arm powering distribution across the region.', 'Ranchi, Jharkhand', 0),
  ('MR Shoppee', 'Multi-brand Menswear Retail', 'A retail chain of multi-brand menswear outlets serving walk-in customers across the city.', 'Multiple Outlets, Ranchi', 1),
  ('Kids Kamp / Nidhi Apparels', 'Premier Kidswear Showroom', 'A premier kidswear retail showroom stocking the season''s best across ages.', 'Upper Bazar, Ranchi', 2)
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- Sample lookbook articles (edit / replace from the CRM)
-- ---------------------------------------------------------------------------
insert into catalog_items (brand, style_code, description, mrp, dealer_net_rate, moq, size_curve, is_ready_stock, sort_order) values
  ('Van Heusen Athleisure', '61083', 'Vest with back mesh', 699, 466, 'Pack of 3', 'M-L-XL-XXL', true, 0),
  ('Twills', 'TW-2201', 'Slim-fit cotton casual shirt', 1499, 899, 'Pack of 6', 'M-L-XL-XXL', true, 1),
  ('Mudo Jeans', 'MD-501', 'Stretch slim denim', 2199, 1249, 'Pack of 5', '30-32-34-36-38', true, 2)
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- Customers — 49 parties from the Sept 2026 secondary sales report
-- ---------------------------------------------------------------------------
insert into customers (party_code, party_name, gstin) values
  ('JHRAN000008', 'BIG SHOP', '20AAPFB2006A1ZG'),
  ('JHRAN000074', 'BIJAY KUMAR AND BROTHERS', '20AAAFB9545M1ZG'),
  ('VHIND000188', 'M/S Laxmi Narayan Jewellers & Vastralaya', '20AUUPG0584H1ZN'),
  ('VHIND008839', 'Raj Collections New', '20ABFFR4104E1ZX'),
  ('VHIND011205', 'Gayatri Vastralaya', '20AWAPA8187E1Z0'),
  ('VHIND019287', 'Rampuria Garments', '20AABHB6182R1Z6'),
  ('VHIND019583', 'M R Readymade', '20BSWPJ5147E1ZQ'),
  ('JHRAN000060', 'VARIETY COLLECTION', '12ABCAE3456F7Z8'),
  ('JHRAN000042', 'BHUSHAN DRESSES', '12ABCAE3456F7Z8'),
  ('JHRAN000005', 'BHADANI FASHION MART(NEW)', '20ACPPB9859H2ZD'),
  ('VHIND022980', 'B S TRADERS', '20AHBPJ1724A1ZG'),
  ('JHRAN000004', 'BINNY DRESSES', '12ABCAE3456F7Z8'),
  ('JHRAN000051', 'NATIONAL STORE', '20ABSPJ5999C1ZE'),
  ('JHRAN000066', 'Radha Krishna Firayalal & Co', '20AAQFR2197B1ZD'),
  ('JHRAN000053', 'VED APPARELS & TEXTILES', '20AAJFV6077D1Z9'),
  ('JHRAN000068', 'MANOJ ENTERPRISES', '20AJOPA0612P1ZJ'),
  ('VHIND027896', 'Shree Radhey Radhey', '20BNNPK5453Q1ZI'),
  ('VHIND026920', 'Shree Traders', '20KKCPK6356M1ZU'),
  ('VHIND017589', 'Fashion Republic.', '20AAJPY9813A1ZT'),
  ('JHRAN000022', 'VIJAY READYMADE', '12ABCAE3456F7Z8'),
  ('JHRAN000099', 'VARUN VASTRALAYA', '20ADJPJ7246F1ZT'),
  ('VHIND005937', 'PUJA NXT', '20AVHPH9983K1Z5'),
  ('VHIND027909', 'Priti Vastralya', '20AATPA9211E1Z7'),
  ('VHIND020001', 'Malani Vastralaya', '20AABFM5730E1ZY'),
  ('JHRAN000034', 'PARIDHAN BARGAIN SHOP', '20AAGFP7572A1ZM'),
  ('VHIND006510', 'Rounak Garments', '20BIHPK0236L1ZL'),
  ('VHIND023059', 'Saket Dresses', '12ABCAE3456F7Z8'),
  ('VHIND027923', 'Paras Hosiery', '20ADAPS1907K1ZU'),
  ('VHIND005274', 'Upasana Collection', '20ADYPJ1978K1Z0'),
  ('VHIND000371', 'Vaisnavi Vastralaya', '20BMIPK7595K1ZM'),
  ('320541', 'C2D VENTURES LLP', '20AAOFC0199C1ZU'),
  ('JHRAN000121', 'BALMIKI VASTRALAYA', '20AGYPP3807G1Z9'),
  ('JHRAN000167', 'N.S. ISMAIL GARMENTS', '20BQLPA8666E1Z0'),
  ('JHRAN000040', 'ARVIND DRESSES', '20DQVPS5244A1ZU'),
  ('VHIND018665', 'Pafex Lifestyle Private Limited', '20AAJCP8083E1ZH'),
  ('JHRAN000133', 'JAIN VASTRALAYA', '20AUUPJ9163D1ZJ'),
  ('VHIND026361', 'Ganpati Handloom', '20AKTPT8699P2ZP'),
  ('JHRAN000021', 'VIKAS DRESSES', '20AEZPB3526P1Z7'),
  ('JHRAN000010', 'GANPATI GARMENTS(JMT)', '20BHQPS5607B1ZJ'),
  ('VHIND026672', 'RAJGHARNA Nxt', '20ABMFR3832L1Z2'),
  ('JHRAN000007', 'RAM HANDLOOM', '20AUGPK8420J1ZT'),
  ('JHRAN000012', 'HARI COLLECTION', '20ACRPB8921E1ZX'),
  ('VHIND016046', 'Nandan Garments', '20AJEPP1793N2ZX'),
  ('JHRAN000088', 'ANAND BAZAR', '20ABHFA0979Q1Z4'),
  ('JHRAN000116', 'RAHUL DRESSES', '20AAPPC8046D1Z4'),
  ('JHRAN000136', 'Prakash Garments', '20AOIPP0545H2Z8'),
  ('JHRAN000023', 'SUBODH DRESS COLLECTION', '20ADTPG2833M1ZG'),
  ('JHRAN000094', 'MATCHING POINT', '12ABCAE3456F7Z8'),
  ('VHIND007659', 'Mahalaxmi Readymade', '20AINPK7105M1Z8')
on conflict (party_code) do update set
  party_name = excluded.party_name,
  gstin = coalesce(excluded.gstin, customers.gstin);

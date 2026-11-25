-- ORSAVEN — reference data (idempotent)

INSERT OR IGNORE INTO roles (id,name,description,rank) VALUES
 ('super_admin','Super Admin','Full control including approvals, publishing and role assignment',100),
 ('administrator','Administrator','Operates catalog, orders and inquiries; cannot approve, publish or assign roles',50),
 ('customer','Customer','Purchases products and manages own account',0);

INSERT OR IGNORE INTO permissions (key,description) VALUES
 ('admin.access','Access the admin application'),
 ('product.read_all','Read products in any status'),
 ('product.write','Create and edit products, versions and pricing'),
 ('product.submit','Submit products for review'),
 ('product.approve','Approve or reject products under review'),
 ('product.publish','Publish or unpublish products'),
 ('product.archive','Archive products'),
 ('category.write','Manage categories'),
 ('asset.write','Upload and manage product files'),
 ('order.read_all','Read all orders'),
 ('order.update','Update order fulfilment state (never payment state)'),
 ('payment.read','Read payment records'),
 ('customer.read','Read customer records'),
 ('inquiry.read','Read service inquiries'),
 ('inquiry.update','Update service inquiries'),
 ('download.read','Read download activity'),
 ('audit.read','Read audit logs'),
 ('settings.write','Edit site settings'),
 ('legal.write','Edit legal documents'),
 ('legal.approve','Approve legal documents'),
 ('user.role_assign','Assign user roles'),
 ('export.data','Export permitted records');

INSERT OR IGNORE INTO role_permissions (role_id,permission_key) VALUES
 ('super_admin','admin.access'),
 ('super_admin','product.read_all'),
 ('super_admin','product.write'),
 ('super_admin','product.submit'),
 ('super_admin','product.approve'),
 ('super_admin','product.publish'),
 ('super_admin','product.archive'),
 ('super_admin','category.write'),
 ('super_admin','asset.write'),
 ('super_admin','order.read_all'),
 ('super_admin','order.update'),
 ('super_admin','payment.read'),
 ('super_admin','customer.read'),
 ('super_admin','inquiry.read'),
 ('super_admin','inquiry.update'),
 ('super_admin','download.read'),
 ('super_admin','audit.read'),
 ('super_admin','settings.write'),
 ('super_admin','legal.write'),
 ('super_admin','legal.approve'),
 ('super_admin','user.role_assign'),
 ('super_admin','export.data'),
 ('administrator','admin.access'),
 ('administrator','product.read_all'),
 ('administrator','product.write'),
 ('administrator','product.submit'),
 ('administrator','product.archive'),
 ('administrator','category.write'),
 ('administrator','asset.write'),
 ('administrator','order.read_all'),
 ('administrator','order.update'),
 ('administrator','payment.read'),
 ('administrator','customer.read'),
 ('administrator','inquiry.read'),
 ('administrator','inquiry.update'),
 ('administrator','download.read'),
 ('administrator','audit.read'),
 ('administrator','settings.write'),
 ('administrator','legal.write'),
 ('administrator','export.data');

INSERT OR IGNORE INTO product_categories (family,slug,name_id,name_en,sort_order) VALUES
 ('digital_assets','templates','Template','Templates',1),
 ('digital_assets','documents','Dokumen','Documents',2),
 ('digital_assets','design-resources','Sumber Daya Desain','Design Resources',3),
 ('digital_assets','productivity-resources','Sumber Daya Produktivitas','Productivity Resources',4),
 ('digital_assets','digital-downloads','Unduhan Digital','Digital Downloads',5),
 ('digital_assets','reusable-materials','Materi Pakai Ulang','Reusable Materials',6),
 ('business_kits','operating-kits','Kit Operasional Bisnis','Business Operating Kits',1),
 ('business_kits','sop-collections','Koleksi SOP','SOP Collections',2),
 ('business_kits','business-templates','Template Bisnis','Business Templates',3),
 ('business_kits','operational-systems','Sistem Operasional','Operational Systems',4),
 ('business_kits','workflow-toolkits','Toolkit Alur Kerja','Workflow Toolkits',5),
 ('business_kits','playbooks','Playbook','Playbooks',6),
 ('agentic_solutions','agent-configurations','Konfigurasi Agen AI','AI Agent Configurations',1),
 ('agentic_solutions','agentic-workflows','Alur Kerja Agentik','Agentic Workflows',2),
 ('agentic_solutions','automation-packages','Paket Otomasi','Automation Packages',3),
 ('agentic_solutions','agent-systems','Sistem Agen Pakai Ulang','Reusable Agent Systems',4),
 ('agentic_solutions','ai-operating-systems','Sistem Operasi AI','AI Operating Systems',5),
 ('agentic_solutions','deployment-packages','Paket Deployment','Deployment Packages',6),
 ('implementation_services','system-implementation','Implementasi Sistem','System Implementation',1),
 ('implementation_services','workflow-configuration','Konfigurasi Alur Kerja','Workflow Configuration',2),
 ('implementation_services','technical-setup','Penyiapan Teknis','Technical Setup',3),
 ('implementation_services','integration','Integrasi','Integration',4),
 ('implementation_services','customization','Kustomisasi','Customization',5),
 ('implementation_services','deployment-assistance','Bantuan Deployment','Deployment Assistance',6);

INSERT OR IGNORE INTO product_licenses (key,name_id,name_en,summary_id,summary_en,terms_id,terms_en,status) VALUES
 ('personal','Lisensi Personal','Personal License','Untuk penggunaan satu orang. Tidak boleh dijual ulang atau dibagikan ulang.','For use by one individual. No resale or redistribution.','DRAFT — ketentuan lengkap memerlukan tinjauan hukum sebelum digunakan untuk transaksi.','DRAFT — full terms require legal review before use in transactions.','draft'),
 ('business','Lisensi Bisnis','Business License','Untuk penggunaan internal satu organisasi. Tidak boleh dijual ulang.','For internal use within one organization. No resale.','DRAFT — ketentuan lengkap memerlukan tinjauan hukum sebelum digunakan untuk transaksi.','DRAFT — full terms require legal review before use in transactions.','draft'),
 ('service','Perjanjian Layanan','Service Agreement','Layanan diatur oleh lingkup kerja tertulis yang disepakati per proyek.','Services are governed by a written scope of work agreed per engagement.','DRAFT — memerlukan tinjauan hukum.','DRAFT — requires legal review.','draft');

INSERT OR IGNORE INTO legal_documents (slug,title_id,title_en,body_id,body_en,status) VALUES
 ('privacy','Kebijakan Privasi','Privacy Policy','> **DRAFT — belum ditinjau dan belum disetujui.** Dokumen ini adalah kerangka kerja awal dan tidak boleh dianggap sebagai ketentuan hukum yang berlaku sampai ditinjau oleh penasihat hukum dan disetujui oleh pemilik ORSAVEN.

## Data yang kami kumpulkan
- Data akun yang diproses oleh penyedia autentikasi kami (Clerk), seperti alamat email.
- Data profil yang Anda isi secara sukarela (nama tampilan, perusahaan, negara).
- Catatan pesanan, akses unduhan, dan pertanyaan layanan yang Anda kirimkan.
- Data teknis terbatas untuk keamanan (misalnya hash alamat IP untuk pembatasan laju).

## Tujuan penggunaan
Menyediakan akun, memproses pesanan, mengirim produk digital, menanggapi pertanyaan, dan menjaga keamanan layanan.

## Pihak ketiga
Clerk (autentikasi) dan Cloudflare (hosting & basis data). Penyedia pembayaran akan dicantumkan setelah diaktifkan.

## Hak Anda
[Perlu ditinjau: hak akses, koreksi, penghapusan, dan dasar hukum berdasarkan UU PDP Indonesia dan regulasi lain yang berlaku.]

## Kontak
[Perlu ditetapkan: alamat kontak privasi resmi.]','> **DRAFT — not reviewed and not approved.** This document is an initial framework and must not be treated as binding legal terms until reviewed by legal counsel and approved by the ORSAVEN owner.

## Data we collect
- Account data processed by our authentication provider (Clerk), such as email address.
- Profile data you choose to provide (display name, company, country).
- Order records, download access, and service inquiries you submit.
- Limited technical data for security (for example hashed IP addresses for rate limiting).

## Purposes
Providing accounts, processing orders, delivering digital products, responding to inquiries, and keeping the service secure.

## Third parties
Clerk (authentication) and Cloudflare (hosting & database). Payment providers will be listed once activated.

## Your rights
[Requires review: access, correction, deletion rights and legal bases under Indonesian PDP Law and other applicable regulations.]

## Contact
[To be defined: official privacy contact address.]','draft'),
 ('terms','Ketentuan Layanan','Terms of Service','> **DRAFT — belum ditinjau dan belum disetujui.** Dokumen ini adalah kerangka kerja awal dan tidak boleh dianggap sebagai ketentuan hukum yang berlaku sampai ditinjau oleh penasihat hukum dan disetujui oleh pemilik ORSAVEN.

## Ruang lingkup
ORSAVEN adalah katalog produk digital dan layanan implementasi. Setiap produk mencantumkan cakupan, persyaratan, lisensi, dan metode pengiriman.

## Akun
Anda bertanggung jawab menjaga keamanan akun Anda.

## Pembelian
Pesanan hanya dianggap dibayar setelah konfirmasi terverifikasi dari penyedia pembayaran.

## Lisensi
Penggunaan produk diatur oleh lisensi yang tercantum pada halaman produk.

## Batasan
ORSAVEN tidak menjamin hasil bisnis, pendapatan, atau hasil otomasi tertentu.

## Hukum yang berlaku
[Perlu ditinjau.]','> **DRAFT — not reviewed and not approved.** This document is an initial framework and must not be treated as binding legal terms until reviewed by legal counsel and approved by the ORSAVEN owner.

## Scope
ORSAVEN is a catalog of digital products and implementation services. Each product lists its scope, requirements, license, and delivery method.

## Accounts
You are responsible for keeping your account secure.

## Purchases
An order is only considered paid after verified confirmation from the payment provider.

## Licenses
Product use is governed by the license stated on the product page.

## Limitations
ORSAVEN does not guarantee specific business results, revenue, or automation outcomes.

## Governing law
[Requires review.]','draft'),
 ('refund','Kebijakan Pengembalian Dana','Refund Policy','> **DRAFT — belum ditinjau dan belum disetujui.** Dokumen ini adalah kerangka kerja awal dan tidak boleh dianggap sebagai ketentuan hukum yang berlaku sampai ditinjau oleh penasihat hukum dan disetujui oleh pemilik ORSAVEN.

## Prinsip
Kami akan meninjau permintaan pengembalian dana secara adil, terutama jika produk tidak sesuai deskripsi atau tidak dapat dikirim.

## Produk digital
[Perlu ditetapkan: jangka waktu permintaan, kondisi kelayakan, dan pengecualian.]

## Layanan implementasi
Diatur oleh lingkup kerja tertulis per proyek.

## Cara mengajukan
Kirim pertanyaan melalui halaman Kontak dengan nomor pesanan Anda.','> **DRAFT — not reviewed and not approved.** This document is an initial framework and must not be treated as binding legal terms until reviewed by legal counsel and approved by the ORSAVEN owner.

## Principle
We will review refund requests fairly, especially where a product does not match its description or cannot be delivered.

## Digital products
[To be defined: request window, eligibility conditions, and exclusions.]

## Implementation services
Governed by the written scope of work per engagement.

## How to request
Submit an inquiry through the Contact page with your order number.','draft'),
 ('delivery','Kebijakan Pengiriman','Delivery Policy','> **DRAFT — belum ditinjau dan belum disetujui.** Dokumen ini adalah kerangka kerja awal dan tidak boleh dianggap sebagai ketentuan hukum yang berlaku sampai ditinjau oleh penasihat hukum dan disetujui oleh pemilik ORSAVEN.

## Produk digital
Setelah pembayaran terverifikasi dan pesanan selesai, file tersedia di Akun → Unduhan. Tautan unduhan bersifat pribadi, berlaku singkat, dan dibatasi jumlah penggunaannya.

## Layanan
Jadwal dan hasil kerja mengikuti lingkup kerja yang disepakati.

## Kendala
Jika Anda tidak dapat mengakses file, hubungi kami melalui halaman Kontak.','> **DRAFT — not reviewed and not approved.** This document is an initial framework and must not be treated as binding legal terms until reviewed by legal counsel and approved by the ORSAVEN owner.

## Digital products
After payment is verified and the order is completed, files become available under Account → Downloads. Download links are private, short-lived, and use-limited.

## Services
Schedules and deliverables follow the agreed scope of work.

## Issues
If you cannot access your files, contact us through the Contact page.','draft');

INSERT OR IGNORE INTO site_settings (key,value_json,is_public) VALUES
 ('site.name','"ORSAVEN"',1),
 ('site.tagline','{"id": "Produk digital praktis, siap digunakan.", "en": "Practical digital products, ready to put to work."}',1),
 ('site.contact_email','""',1),
 ('commerce.checkout_enabled','false',1),
 ('commerce.payment_provider','"none"',0),
 ('delivery.link_ttl_minutes','15',0),
 ('delivery.max_uses','3',0),
 ('site.announcement','{"id": "", "en": ""}',1);

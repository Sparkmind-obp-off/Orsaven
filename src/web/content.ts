/**
 * Editorial content (bilingual). Truthful only: derived from docs/ (approved brand docs).
 * No statistics, testimonials, ratings, partners or certifications.
 */
import type { Bilingual } from './i18n'

export const FAQ: { q: Bilingual; a: Bilingual }[] = [
  {
    q: { id: 'Apa itu ORSAVEN?', en: 'What is ORSAVEN?' },
    a: {
      id: 'ORSAVEN adalah merek produktisasi dan katalog produk digital. Kami mengemas aset digital, kit bisnis, solusi agentik, dan layanan implementasi agar lebih mudah dipahami dan digunakan.',
      en: 'ORSAVEN is a productization and digital product catalog brand. We package digital assets, business kits, agentic solutions, and implementation services so they are easier to understand and adopt.',
    },
  },
  {
    q: { id: 'Apakah semua produk menggunakan AI?', en: 'Is every product AI-powered?' },
    a: {
      id: 'Tidak. Banyak produk adalah template, dokumen, atau sistem kerja biasa. Produk dalam Agentic Solutions mencantumkan penyedia, dependensi, izin, titik persetujuan manusia, dan batasannya. ORSAVEN tidak mengklaim memiliki atau melatih model AI pihak ketiga.',
      en: 'No. Many products are templates, documents, or operating systems without AI. Products in Agentic Solutions list their providers, dependencies, permissions, human approval points, and limitations. ORSAVEN does not claim to own or train third-party AI models.',
    },
  },
  {
    q: { id: 'Bagaimana produk dikirim?', en: 'How are products delivered?' },
    a: {
      id: 'Setelah pembayaran terverifikasi oleh penyedia pembayaran dan pesanan selesai, file tersedia di Akun → Pustaka. Tautan unduhan bersifat pribadi, berlaku singkat, dan dibatasi jumlah penggunaannya.',
      en: 'After payment is verified by the payment provider and the order completes, files appear under Account → Library. Download links are private, short-lived, and use-limited.',
    },
  },
  {
    q: { id: 'Apakah pembayaran sudah aktif?', en: 'Is payment active?' },
    a: {
      id: 'Belum. Checkout berbayar diaktifkan hanya setelah penyedia pembayaran, dokumen legal, pengiriman, dan dukungan diuji dan disetujui. Sampai saat itu, Anda dapat mengirim pertanyaan melalui halaman Kontak.',
      en: 'Not yet. Paid checkout is enabled only after the payment provider, legal documents, delivery, and support have been tested and approved. Until then, you can send an inquiry through the Contact page.',
    },
  },
  {
    q: { id: 'Apa arti label kematangan produk?', en: 'What do the maturity labels mean?' },
    a: {
      id: 'Konsep: belum dijual. Prototipe: eksperimental. Beta: rilis terbatas dengan batasan yang dinyatakan. Tersedia: proses pengiriman telah diuji dan dukungan ditetapkan. Dihentikan: tidak dijual lagi.',
      en: 'Concept: not for sale. Prototype: experimental. Beta: limited release with stated constraints. Available: delivery tested and support defined. Retired: no longer sold.',
    },
  },
  {
    q: { id: 'Apa itu “Contoh listing”?', en: 'What is an “Example listing”?' },
    a: {
      id: 'Listing contoh menunjukkan format halaman produk ORSAVEN. Listing ini bukan produk nyata dan tidak dapat dibeli.',
      en: 'Example listings demonstrate the ORSAVEN product page format. They are not real products and cannot be purchased.',
    },
  },
  {
    q: { id: 'Bagaimana layanan implementasi bekerja?', en: 'How do implementation services work?' },
    a: {
      id: 'Layanan bersifat terbatas waktu dengan lingkup tertulis: hasil kerja, tanggung jawab pelanggan, prasyarat, perkiraan jadwal, batas revisi, kriteria penerimaan, dan pengecualian. Harga ditetapkan melalui penawaran.',
      en: 'Services are time-bounded with a written scope: deliverables, customer responsibilities, prerequisites, timeline estimate, revision limits, acceptance criteria, and exclusions. Pricing is by quote.',
    },
  },
  {
    q: { id: 'Bagaimana dengan pengembalian dana?', en: 'What about refunds?' },
    a: {
      id: 'Kebijakan pengembalian dana masih berupa draft dan menunggu tinjauan hukum. Lihat halaman Kebijakan Pengembalian Dana untuk prinsip yang sedang disusun.',
      en: 'The refund policy is still a draft pending legal review. See the Refund Policy page for the principles being drafted.',
    },
  },
]

export const ABOUT = {
  lead: {
    id: 'ORSAVEN mengubah kapabilitas, pengetahuan, aset, alur kerja, dan pengalaman implementasi yang berguna menjadi produk yang jelas, mudah dipahami, dan dapat dibeli.',
    en: 'ORSAVEN turns useful capabilities, knowledge, assets, workflows, and implementation experience into clear, understandable, purchasable products.',
  },
  sections: [
    {
      title: { id: 'Visi', en: 'Vision' },
      body: {
        id: 'Menjadi katalog produk digital praktis dan solusi siap implementasi yang tepercaya dan tertata untuk pelanggan di Indonesia dan pasar internasional.',
        en: 'Become a trusted, well-organized catalog of practical digital products and implementation-ready solutions for customers in Indonesia and international markets.',
      },
    },
    {
      title: { id: 'Misi', en: 'Mission' },
      list: {
        id: [
          'Memproduktisasi pengetahuan dan kapabilitas yang dapat diulang.',
          'Membuat produk digital lebih mudah ditemukan, dipahami, dibandingkan, dan diadopsi.',
          'Menawarkan cakupan, hasil kerja, persyaratan, dan dukungan yang transparan.',
          'Menghubungkan produk mandiri dengan bantuan implementasi opsional.',
          'Menjaga praktik komersial dan teknis yang bertanggung jawab.',
        ],
        en: [
          'Productize repeatable knowledge and capabilities.',
          'Make digital products easier to discover, understand, compare, and adopt.',
          'Offer transparent scope, deliverables, requirements, and support.',
          'Connect self-serve products with optional implementation help.',
          'Maintain responsible commercial and technical practices.',
        ],
      },
    },
    {
      title: { id: 'Batasan merek', en: 'Brand boundaries' },
      body: {
        id: 'ORSAVEN adalah lapisan produk dan distribusi. ORSAVEN tidak menggantikan MAELVYN, EUDELLA, ZUVANE, atau AVORLUNE; tidak mengklaim bahwa semua produk dibuat sendiri; tidak menjanjikan bahwa setiap produk berbasis AI; dan tidak menjamin pendapatan, pertumbuhan, atau hasil otomasi.',
        en: 'ORSAVEN is a product and distribution layer. It does not replace MAELVYN, EUDELLA, ZUVANE, or AVORLUNE; it does not claim all products are built in-house; it does not promise every product is AI-powered; and it does not guarantee income, growth, or automation outcomes.',
      },
    },
  ],
  principles: {
    id: ['Kejelasan sebelum kerumitan.', 'Kegunaan sebelum kebaruan.', 'Bukti sebelum klaim.', 'Cakupan dan harga yang transparan.', 'Kendali manusia dan otomasi yang bertanggung jawab.', 'Kualitas yang dapat dipakai ulang di atas volume sekali pakai.', 'Menghormati identitas merek sumber dan hak pihak ketiga.'],
    en: ['Clarity before complexity.', 'Utility before novelty.', 'Evidence before claims.', 'Transparent scope and pricing.', 'Human control and responsible automation.', 'Reusable quality over one-off volume.', 'Respect for source-brand identity and third-party rights.'],
  },
}

export const QUALITY_GATES: Bilingual<string[]> = {
  id: [
    'Cakupan dan hasil kerja dinyatakan secara eksplisit.',
    'Hak dan lisensi telah ditinjau.',
    'Penyiapan dan pengiriman telah diuji dari awal hingga akhir.',
    'Dependensi dan biaya berulang diungkapkan.',
    'Implikasi keamanan dan privasi didokumentasikan.',
    'Tanggung jawab dukungan dan pengembalian dana ditetapkan.',
    'Versi serta jalur rollback/penghentian tersedia.',
  ],
  en: [
    'Scope and deliverables are explicit.',
    'Rights and licenses are reviewed.',
    'Setup and delivery have been tested end to end.',
    'Dependencies and recurring costs are disclosed.',
    'Security and privacy implications are documented.',
    'Support and refund responsibilities are assigned.',
    'Versioning and rollback/retirement paths exist.',
  ],
}

# 🌿 Wellness Point

A production-ready full-stack e-commerce website for food supplements & wellness products built with **Next.js 14**, **Tailwind CSS**, **MongoDB**, **NextAuth.js**, and **Razorpay**.

![Next.js](https://img.shields.io/badge/Next.js-14-black) ![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue) ![Tailwind CSS](https://img.shields.io/badge/TailwindCSS-3.4-06B6D4) ![MongoDB](https://img.shields.io/badge/MongoDB-Mongoose-47A248)

---

## ✨ Features

### 🛍️ E-Commerce
- **Product Catalog** with search, filtering, and detailed pages
- **Shopping Cart** with persistent state (Zustand + localStorage)
- **Razorpay Payment Integration** (checkout, verification, webhooks ready)
- **Order Management** for customers and admins

### 🔐 Authentication
- **NextAuth.js** with Google, Facebook & Credentials providers
- Role-based access control (User / Admin)
- JWT sessions with 30-day expiry

### 👤 User Dashboard
- Order history with expandable details
- Wishlist management
- Saved addresses (CRUD + set default)
- Profile & password management

### 🛠️ Admin Panel
- Dashboard with revenue & stats overview
- Products CRUD (add, edit, delete, featured toggle)
- Blog posts management
- Testimonials approval system
- Users list & newsletter subscribers
- Order tracking

### 📄 Public Pages
- Home (hero, featured products, benefits, testimonials, CTA)
- Shop (product grid)
- Product Detail (image gallery, tabs, JSON-LD schema)
- About, Contact, FAQ, Blog, Testimonials
- Privacy Policy & Terms of Service

### 🔍 SEO
- Next.js Metadata API with OG tags
- Dynamic sitemap.xml & robots.txt
- JSON-LD structured data on product pages
- Semantic HTML throughout

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|------------|
| Framework | Next.js 14 (App Router) |
| Language | TypeScript 5.3 |
| Styling | Tailwind CSS 3.4 + Custom Design System |
| UI Components | ShadCN UI (Radix Primitives) |
| Database | MongoDB + Mongoose 8 |
| Auth | NextAuth.js 4 (JWT) |
| Payments | Razorpay |
| State | Zustand (cart) |
| Animations | Framer Motion |
| Notifications | React Hot Toast |

---

## 🚀 Getting Started

### Prerequisites
- **Node.js** 18+ and npm/yarn
- **MongoDB** (local or Atlas)
- **Razorpay** account (for payment testing)
- **Google/Facebook OAuth** apps (optional, for social login)

### 1. Clone & Install

```bash
git clone <your-repo-url>
cd "Wellness Point"
npm install
```

### 2. Environment Variables

Copy the example file and fill in your values:

```bash
cp .env.example .env.local
```

Required variables:
```env
MONGODB_URI=mongodb://localhost:27017/wellness-point
NEXTAUTH_SECRET=your-random-secret-key
NEXTAUTH_URL=http://localhost:3000
RAZORPAY_KEY_ID=rzp_test_xxxxx
RAZORPAY_KEY_SECRET=your_key_secret
```

### 3. Seed Database

This creates an admin user and sample products/blogs/testimonials:

```bash
npx tsx scripts/seed.ts
```

**Default admin credentials:**
- Email: `admin@wellness-point.in`
- Password: `admin123`

### 4. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### 5. Build for Production

```bash
npm run build
npm start
```

---

## 📁 Project Structure

```
src/
├── app/
│   ├── admin/          # Admin panel (layout + 7 pages)
│   ├── api/            # API routes (20+ endpoints)
│   ├── checkout/       # Checkout with Razorpay
│   ├── dashboard/      # User dashboard (5 pages)
│   ├── login/          # Login page
│   ├── register/       # Register page
│   ├── shop/           # Product listing
│   ├── product/[slug]/ # Product detail
│   ├── about/          # About page
│   ├── blog/           # Blog listing
│   ├── contact/        # Contact page
│   ├── faq/            # FAQ page
│   ├── testimonials/   # Testimonials page
│   ├── privacy-policy/ # Privacy policy
│   ├── terms/          # Terms of service
│   ├── layout.tsx      # Root layout
│   ├── page.tsx        # Home page
│   ├── sitemap.ts      # Dynamic sitemap
│   └── robots.ts       # Robots config
├── components/
│   ├── ui/             # ShadCN-style base components
│   ├── layout/         # Header, Footer, CartSidebar
│   ├── common/         # ProductCard, NewsletterForm
│   └── home/           # Home page sections
├── lib/                # DB, auth, utils, constants
├── models/             # Mongoose models (7)
├── store/              # Zustand cart store
└── types/              # TypeScript declarations
```

---

## 🔑 API Routes

| Method | Route | Description |
|--------|-------|-------------|
| `POST` | `/api/auth/register` | User registration |
| `*` | `/api/auth/[...nextauth]` | NextAuth handlers |
| `GET` | `/api/products` | List products |
| `GET` | `/api/products/[slug]` | Single product |
| `GET` | `/api/testimonials` | Public testimonials |
| `GET` | `/api/blogs` | Published blogs |
| `POST` | `/api/newsletter` | Subscribe to newsletter |
| `POST` | `/api/contact` | Send contact message |
| `GET/POST` | `/api/wishlist` | User wishlist |
| `GET` | `/api/orders` | User orders |
| `GET/PUT` | `/api/user/profile` | Profile management |
| `POST` | `/api/payment/create-order` | Razorpay order |
| `POST` | `/api/payment/verify` | Verify payment |
| `*` | `/api/admin/*` | Admin CRUD endpoints |

---

## 🎨 Design System

- **Primary Color**: Wellness Green (`#16a34a` → custom palette)
- **Fonts**: Inter (body) + Poppins (headings)
- **Components**: Consistent border-radius, shadow-sm cards, smooth transitions
- **Responsive**: Mobile-first design with breakpoints at sm/md/lg/xl

---

## 📝 License

This project is for educational and commercial use. Customize freely for your business.

---

Built with 💚 by Wellness Point

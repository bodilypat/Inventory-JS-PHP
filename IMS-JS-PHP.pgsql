Full-Stack-Inventory-Management-System/
│
├── Frontend/
│   ├── index.html
│   │
│   ├── pages/
│   │   ├── login.html
│   │   ├── dashboard.html
│   │   ├── products.html
│   │   ├── categories.html
│   │   ├── inventory.html
│   │   ├── purchases.html
│   │   ├── sales.html
│   │   ├── suppliers.html
│   │   ├── customers.html
│   │   ├── reports.html
│   │   ├── users.html
│   │   ├── profile.html 
│   │   └── settings.html 
│   │
│   ├── assets/
│   │   ├── sidebar.html 
│   │   ├── navbar.html 
│   │   ├── footer.html 
│   │   ├── modal.html
│   │   ├── pagination.html
│   │   ├── alerts.html 
│   │   └── loader.html 
│   │
│   ├── css/
│   │   ├── style.css
│   │   ├── variables.css 
│   │   ├── layout.css 
│   │   ├── components.css 
│   │   ├── forms.css
│   │   ├── tables.css
│   │   ├── dashboard.css
│   │   ├── login.css
│   │   ├── products.css
│   │   ├── categories.css 
│   │   ├── inventory.css 
│   │   ├── purchases.css 
│   │   ├── sales.css 
│   │   ├── reports.css 
│   │   └── responsive.css
│   │
│   ├── js/
│   │   ├── app.js
│   │   ├── config.js 
│   │   ├── api.js 
│   │   ├── auth.js 
│   │   ├── router.js
│   │   ├── utils.js
│   │   ├── validation.js
│   │   │
│   │   ├── modules/
│   │   │   ├── dashboard.js 
│   │   │   ├── products.js 
│   │   │   ├── categories.js 
│   │   │   ├── inventory.js 
│   │   │   ├── purchases.js 
│   │   │   ├── sales.js 
│   │   │   ├── suppliers.js
│   │   │   ├── customers.js 
│   │   │   └── users.js
│   │   │
│   │   └── components/
│   │       ├── modal.js 
│   │       ├── table.js 
│   │       ├── pagination.js 
│   │       ├── toast.js 
│   │       └── loader.js 
│   │
│   └── assets/
│       ├── images/
│       │   ├── logo.png
│       │   ├── favicon.png
│       │   └── products/
│       └── icons/
│    
│
├── Backend/
│   │
│   ├── config/
│   │   ├── database.php
│   │   ├── config.php
│   │   └── constants.php
│   │
│   ├── api/
│   │   │
│   │   ├── index.php
│   │   │
│   │   ├── auth/
│   │   │   ├── login.php
│   │   │   ├── register.php
│   │   │   ├── logout.php
│   │   │   ├── me.php 
│   │   │   └── refresh.php 
│   │   │
│   │   ├── dashboard/
│   │   │   └── stats.php
│   │   │
│   │   ├── products/
│   │   │   ├── list.php
│   │   │   ├── get.php
│   │   │   ├── create.php
│   │   │   ├── update.php
│   │   │   ├── delete.php
│   │   │   └── search.php 
│   │   │
│   │   ├── categories/
│   │   │   ├── list.php
│   │   │   ├── get.php 
│   │   │   ├── create.php
│   │   │   ├── update.php
│   │   │   └── delete.php
│   │   │
│   │   ├── inventory/
│   │   │   ├── list.php
│   │   │   ├── stock-in.php
│   │   │   ├── stock-out.php
│   │   │   ├── adjustment.php
│   │   │   ├── movements.php 
│   │   │   └── low-stock.php 
│   │   │
│   │   ├── purchases/
│   │   │   ├── list.php
│   │   │   ├── get.php
│   │   │   ├── create.php
│   │   │   ├── update.php 
│   │   │   ├── receive.php 
│   │   │   └── cancel.php
│   │   │
│   │   ├── sales/
│   │   │   ├── list.php
│   │   │   ├── get.php
│   │   │   ├── create.php
│   │   │   ├── update.php
│   │   │   ├── cancel.php 
│   │   │   └── return.php
│   │   │
│   │   ├── suppliers/
│   │   │   ├── list.php
│   │   │   ├── get.php 
│   │   │   ├── create.php
│   │   │   ├── update.php
│   │   │   └── delete.php
│   │   │
│   │   ├── customers/
│   │   │   ├── list.php
│   │   │   ├── get.php 
│   │   │   ├── create.php
│   │   │   ├── update.php
│   │   │   └── delete.php
│   │   │
│   │   ├── users/
│   │   │   ├── list.php
│   │   │   ├── get.php 
│   │   │   ├── create.php
│   │   │   ├── update.php
│   │   │   ├── delete.php 
│   │   │   └── toggle-status.php
│   │   │
│   │   ├── reports/
│   │   │   ├── sales.php
│   │   │   ├── purchases.php
│   │   │   ├── inventory.php
│   │   │   ├── profit.php 
│   │   │   ├── low-stock.php 
│   │   │   └── export.php
│   │   └── notifications/
│   │       └── list.php
│   │
│   ├── middleware/
│   │   ├── auth.php
│   │   ├── role.php
│   │   ├── cors.php
│   │   ├── rate-limit.php 
│   │   └── error.php
│   │
│   ├── models/
│   │   ├── User.php
│   │   ├── Role.php 
│   │   ├── Product.php
│   │   ├── Category.php
│   │   ├── Supplier.php
│   │   ├── Customer.php
│   │   ├── Purchase.php
│   │   ├── PurchaseItem.php 
│   │   ├── Sale.php
│   │   ├── SaleItem.php 
│   │   ├── Inventory.php 
│   │   ├── InventoryMovement.php 
│   │   └── notification.php
│   │
│   ├── services/
│   │   ├── AuthService.php
│   │   ├── ProductService.php 
│   │   ├── InventoryService.php
│   │   ├── PurchaseService.php
│   │   ├── SalesService.php
│   │   ├── ReportService.php 
│   │   └── notificationService.php 
│   │
│   ├── validations/
│   │   ├── AuthValidator.php
│   │   ├── ProductValidator.php
│   │   ├── PurchaseValidator.php
│   │   └── SaleValidator.php
│   │
│   ├── helpers/
│   │   ├── response.php
│   │   ├── validation.php
│   │   ├── auth.php
│   │   ├── pagination.php
│   │   └── logger.php
│   │
│   └── logs/
│       └── .gitkeep
│
├── database/
│   ├── migrations/
│   ├── inventory.sql
│   └── seed.sql
│
├── storage/
│   ├── uploads/
│   │   └── products/
│   └── exports/
│
├── tests/
│   ├── api/
│   ├── services/
│   └── models/
├── docs/
│   ├── API.md 
│   ├── DATABASE.md 
│   └── SETUP.md 
│
├── .env.example 
├── .gitignore
├── .htaccess
├── composer.json 
└── README.md 


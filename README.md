# DeCasa

Aplicación para crear tiendas online de afiliación Amazon con ganancias recurrentes — sin manipular productos ni envíos.

## Funcionalidades

### Dashboard de control
- Estadísticas de beneficios por día, semana y mes
- Gráficas de evolución de ingresos y clics
- Top productos por beneficio generado
- Resumen de ventas recientes

### Buscador de productos Amazon
- Conector real con la Product Advertising API (PA-API 5)
- Modo demostración con productos de ejemplo para probar sin credenciales
- Filtrado por categoría y ordenación por reseñas, valoraciones y precio
- **Botón "Aceptar y subir"**: tras revisar los artículos, el administrador decide cuáles subir a su tienda

### Tiendas online
- Crear múltiples tiendas con nombres y slugs diferentes
- Modo **automático** o **manual**
- **Botón "Subir / Actualizar"**: publica productos en tu tienda de forma totalmente automática
- Definición de formato de tienda (cuadrícula, lista, carrusel, mosaico)
- Vistas públicas de tienda en `localhost:4000/tienda/<slug>`

### Cuentas de afiliado de Amazon
- Registro de múltiples cuentas y mercados (amazon.es, .com, .co.uk, etc.)
- Enlace directo para registrarse en Amazon Associates
- Tracking ID y marketplace por cuenta

### Cobro de beneficios
- Saldo disponible, pendiente y cobrado
- **Botón de cobro** con selección de método de pago
- Solicitud de cobro con importe a elegir y métodos configurables
- Registro manual de ventas para tracking de beneficios

### Panel de control / Ajustes
- Configuración de credenciales de Amazon PA-API
- Modo demostración activable/desactivable
- Métodos de pago (PayPal, transferencia, cripto, tarjeta, cheque)
- Ajustes generales: moneda, comisión por defecto, subida automática

## Instalación

```bash
cd DeCasa

# Instalar dependencias de root, server y client
npm run install:all

# Desarrollo (servidor + cliente en paralelo)
npm run dev

# Producción
npm start
```

- **Servidor API**: `http://localhost:4000`
- **Frontend (desarrollo)**: `http://localhost:5173` (proxy automático al servidor en 4000)
- **App completa**: `http://localhost:4000` (una vez compilado)

## Modo demostración

Por defecto, la aplicación funciona en modo demostración. Busca productos de ejemplo con
reseñas simuladas. Para usar productos reales de Amazon, introduce tus credenciales de la
**Product Advertising API (PA-API)** y tu **Partner Tag** (ID de afiliado) en el Panel de control.

## Stack tecnológico

- **Backend**: Node.js, Express, better-sqlite3
- **Frontend**: React 18, React Router 6, Recharts, Vite
- **Base de datos**: SQLite (archivos en `server/data/`)
- **Integración Amazon**: PA-API 5 con firma AWS Signature Version 4

## Licencia

MIT

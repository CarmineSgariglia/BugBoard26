## Layouts
Questi sono i layout che ho creato per l'applicazione:

- AuthLayout: Layout per le pagine di autenticazione (login, recupero password) 
- MainLayout: Layout per le pagine autenticate (progetti, impostazioni)
- AppBackground: Background per l'applicazione interna (Usato in MainLayout)
- TopNav: Barra di navigazione superiore (Usato in MainLayout)

## OUTLET
OUTLET che serve per renderizzare le pagine che gli passiamo da App.tsx
In questo modo possiamo riutilizzare lo stesso layout per diverse pagine senza riscriverlo ogni volta, mantenendo il codice pulito e organizzato. Ciò evita caricamenti inutili e mantiene l'interfaccia coerente.


## AuthLayout e MainLayout
Sono usati nelle route di App.tsx.


## GlassCard: 
Poiché <Outlet /> si trova all'interno della GlassCard in AuthLayout, tutte le pagine di autenticazione (login, recupero password) verranno automaticamente renderizzate dentro questo componente. In questo modo otteniamo l'effetto vetro smerigliato su tutte queste viste senza dover importare o riscrivere la GlassCard in ogni singola pagina.


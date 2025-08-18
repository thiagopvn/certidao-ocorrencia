# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a **Certificate of Occurrence Request System** (Sistema de Certidão de Ocorrência) for the GOCG (Grupamento Operacional do Comando Geral). It's a web application built on Firebase that allows citizens to request police occurrence certificates online and enables administrators to manage these requests.

## Architecture

### Frontend
- **Static HTML/CSS/JavaScript** hosted on Firebase Hosting
- **Vanilla JavaScript** with Firebase SDK v8 (no frontend frameworks)
- **Two main interfaces:**
  - `public/index.html` - Citizen-facing form for submitting requests and checking status
  - `public/admin.html` - Administrative interface for managing requests
  - `public/feedback.html` - Satisfaction survey page

### Backend
- **Firebase Functions v2** in `functions/index.js`
- **Firebase Realtime Database** for data storage
- **Firebase Storage** for document uploads
- **Firebase Authentication** for admin access
- **Nodemailer** for automated email notifications

### Key Data Flow
1. Citizens submit occurrence requests via the main form
2. Documents are uploaded to Firebase Storage
3. Data is stored in Realtime Database with auto-generated occurrence numbers (OCR-XXXXXX)
4. Firebase Functions handle email automation and status updates
5. Admins manage requests through the admin interface

## Development Commands

### Firebase Functions
```bash
# Navigate to functions directory
cd functions

# Install dependencies
npm install

# Start local emulator
npm run serve

# Deploy functions only
npm run deploy

# View function logs
npm run logs
```

### Firebase Hosting
```bash
# Deploy hosting only
firebase deploy --only hosting

# Deploy everything
firebase deploy

# Serve locally
firebase serve
```

## Key Firebase Functions

### Email Automation
- `enviarEmailNovaOcorrencia` - Sends confirmation email when new request is created
- `enviarEmailAutomatico` - Sends certificate email when status changes to "Concluído"
- `enviarPesquisaSatisfacao` - Sends satisfaction survey 5 minutes after completion
- `enviarLembretesOcorrenciasPendentes` - Daily reminders for requests pending >7 days

### Admin Functions
- `uploadCertidao` - Handles certificate file uploads
- `reenviarEmailCertidao` - Manual resend of certificate emails
- `marcarNotificacaoLida` - Mark admin notifications as read

### Automated Maintenance
- `limparNotificacoesAntigas` - Monthly cleanup of old notifications
- `gerarRelatorioMensal` - Monthly occurrence reports
- `backupDadosSemanais` - Weekly data backups
- `atualizarContadores` - Real-time status counters

## Database Structure

```
/ocorrencias/{occurrenceId}
  - timestamp: submission timestamp
  - status: "Pendente" | "Concluído"
  - nome, cpf, rg, email, telefone: personal data
  - dataOcorrencia, enderecoOcorrencia, descricao: incident details
  - documentos: {object} - uploaded document URLs
  - certidao: {url, timestamp} - generated certificate
  - emailConfirmacao, emailEnviado: email status tracking

/notificacoes/{notificationId}
  - tipo: notification type
  - occurrenceId: related occurrence
  - timestamp, lida: notification metadata

/contadores
  - Pendente, Concluído, total: status counters
```

## Security Features

- **CPF-based access control** - Users can only view their own requests
- **Firebase Authentication** for admin access
- **CORS configuration** in `cors.json`
- **Environment variables** for sensitive data (email credentials)

## Email Configuration

Email sending uses Gmail SMTP via Nodemailer:
- **Development:** Hardcoded credentials in functions (should be moved to environment)
- **Production:** Uses Firebase environment variables
- **Templates:** HTML email templates with GOCG branding
- **Attachments:** Includes GOCG logo (`bolachaGOCG.png`)

## Common Development Tasks

### Adding New Email Templates
1. Modify the relevant function in `functions/index.js`
2. Update HTML template with GOCG styling
3. Test with Firebase emulator before deploying

### Debugging Email Issues
- Check function logs: `firebase functions:log`
- Verify email credentials in Firebase environment
- Test email delivery in functions emulator

### Database Queries
- All queries use Firebase Realtime Database syntax
- Security relies on client-side CPF filtering (not server-side rules)
- Status filtering is handled in frontend JavaScript

### File Upload Process
1. Files uploaded to Firebase Storage with path: `/ocorrencias/{id}/{type}/{filename}`
2. Download URLs stored in database under `documentos` object
3. Admin certificate uploads use signed URLs via `uploadCertidao` function

## Environment Setup

### Required Firebase Services
- Authentication (for admin login)
- Realtime Database (for data storage)
- Storage (for document uploads)
- Functions (for backend logic)
- Hosting (for web interface)

### Email Configuration
Set Firebase environment variables:
```bash
firebase functions:config:set email.user="gocg.certidao@gmail.com"
firebase functions:config:set email.pass="your-app-password"
```

## Deployment Notes

- Frontend is served from `public/` directory
- Functions deployed from `functions/` directory
- Static assets include Firebase SDK v8 (CDN-hosted)
- CORS configuration allows all origins (consider restricting for production)
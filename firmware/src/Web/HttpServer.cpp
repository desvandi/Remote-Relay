// =============================================================================
// Web/HttpServer.cpp — Main HTTP server setup + dispatch
// =============================================================================
#include "HttpServer.h"
#include "Web/Handlers/AuthHandlers.h"
#include "Web/Handlers/StatusHandlers.h"
#include "Web/Handlers/RelayHandlers.h"
#include "Web/Handlers/ScheduleHandlers.h"
#include "Web/Handlers/PirHandlers.h"
#include "Web/Handlers/TimeHandlers.h"
#include "Web/Handlers/LogHandlers.h"
#include "Web/Handlers/ConfigHandlers.h"
#include "Web/Handlers/SystemHandlers.h"
#include "Web/Handlers/OtaHandlers.h"
#include "Web/Handlers/FactoryResetHandlers.h"

namespace Web {

WebServer http(80);
HttpServer server;

void HttpServer::_sendSecurityHeaders() {
  http.sendHeader("X-Frame-Options", "DENY");
  http.sendHeader("X-Content-Type-Options", "nosniff");
  http.sendHeader("Cache-Control", "no-store");
  http.sendHeader("Referrer-Policy", "no-referrer");
  http.sendHeader("Content-Security-Policy",
    "default-src 'self'; script-src 'self' 'unsafe-inline'; "
    "style-src 'self' 'unsafe-inline'; img-src 'self' data:;");
  // CORS for PWA on different origin (Vercel → ESP32 via Cloudflare Tunnel)
  http.sendHeader("Access-Control-Allow-Origin", "*");
  http.sendHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  http.sendHeader("Access-Control-Allow-Headers",
    "Content-Type, Authorization, X-CSRF-Token");
  http.sendHeader("Access-Control-Allow-Credentials", "true");
}

void HttpServer::_sendJson(const String& body, int code) {
  _sendSecurityHeaders();
  http.send(code, "application/json; charset=utf-8", body);
}

void HttpServer::_sendJsonSuccess(const String& message, const String& dataJson) {
  String body = "{\"success\":true,\"message\":\"";
  body += message;
  body += "\",\"data\":";
  body += dataJson;
  body += "}";
  _sendJson(body, 200);
}

void HttpServer::_sendJsonError(int code, const String& message) {
  String body = "{\"success\":false,\"message\":\"";
  body += message;
  body += "\",\"data\":null}";
  _sendJson(body, code);
}

void HttpServer::_registerRoutes() {
  // CORS preflight
  http.onNotFound([]() {
    if (http.method() == HTTP_OPTIONS) {
      Web::server._sendSecurityHeaders();
      http.send(204);
    } else {
      Web::server._sendJsonError(404, "Not Found");
    }
  });

  // Auth
  http.on("/api/login", HTTP_POST, Web::Handlers::handleLogin);
  http.on("/api/logout", HTTP_POST, Web::Handlers::handleLogout);
  http.on("/api/session", HTTP_GET, Web::Handlers::handleSession);

  // Status
  http.on("/api/status", HTTP_GET, Web::Handlers::handleStatus);
  http.on("/api/version", HTTP_GET, Web::Handlers::handleVersion);
  http.on("/api/health", HTTP_GET, Web::Handlers::handleHealth);

  // Relay
  http.on("/api/relay", HTTP_POST, Web::Handlers::handleRelay);

  // Schedule
  http.on("/api/schedule", HTTP_POST, Web::Handlers::handleScheduleUpsert);
  http.on("/api/schedule", HTTP_DELETE, Web::Handlers::handleScheduleDelete);

  // PIR
  http.on("/api/pir", HTTP_POST, Web::Handlers::handlePirConfig);
  http.on("/api/pir/test", HTTP_POST, Web::Handlers::handlePirTest);

  // Time
  http.on("/api/time", HTTP_POST, Web::Handlers::handleSetTime);

  // Logs
  http.on("/api/log", HTTP_GET, Web::Handlers::handleGetLogs);
  http.on("/api/audit_log", HTTP_GET, Web::Handlers::handleGetAuditLog);

  // Config
  http.on("/api/config", HTTP_GET, Web::Handlers::handleGetConfig);
  http.on("/api/config", HTTP_POST, Web::Handlers::handleSetConfig);
  http.on("/api/config/device", HTTP_POST, Web::Handlers::handleSetDeviceConfig);
  http.on("/api/config/password", HTTP_POST, Web::Handlers::handleChangePassword);
  http.on("/api/config/export", HTTP_GET, Web::Handlers::handleExportConfig);
  http.on("/api/config/import", HTTP_POST, Web::Handlers::handleImportConfig);

  // System
  http.on("/api/reboot", HTTP_POST, Web::Handlers::handleReboot);

  // OTA
  http.on("/api/ota", HTTP_POST, Web::Handlers::handleOtaResponse, Web::Handlers::handleOtaUpload);
  http.on("/api/ota/check", HTTP_POST, Web::Handlers::handleOtaCheck);

  // Factory reset (two-step)
  http.on("/api/factory_reset/prepare", HTTP_POST, Web::Handlers::handleFactoryResetPrepare);
  http.on("/api/factory_reset/confirm", HTTP_POST, Web::Handlers::handleFactoryResetConfirm);

  // Collect headers we need
  const char* headerKeys[] = {"Authorization", "X-CSRF-Token", "Content-Length", "Cookie", "Origin"};
  http.collectHeaders(headerKeys, 5);
}

void HttpServer::begin() {
  _registerRoutes();
  http.begin();
}

void HttpServer::handleClient() {
  http.handleClient();
}

} // namespace Web

// Expose helpers globally for handlers
namespace Web {
String sendJsonSuccess(const String& message, const String& dataJson) {
  server._sendJsonSuccess(message, dataJson);
  return "";
}
void sendJsonError(int code, const String& message) {
  server._sendJsonError(code, message);
}
bool checkAuth() {
  return Services::auth.checkAuth(http);
}
bool checkCsrf() {
  return Services::auth.checkCsrfToken(http);
}
bool checkBodySize(size_t maxSize) {
  if (http.hasHeader("Content-Length")) {
    size_t len = (size_t)http.header("Content-Length").toInt();
    if (len > maxSize) {
      sendJsonError(413, "Body too large");
      return false;
    }
  }
  return true;
}
}

<?php
// logout.php
header('Content-Type: application/json; charset=utf-8');

// ⚠️ Ajustá la ruta a tu PDO:
require_once __DIR__ . '/../../config/db.php';

if (session_status() === PHP_SESSION_NONE) {
  session_start();
}

/**
 * Si usás PHP sessions:
 * - destruimos la sesión del servidor para invalidar.
 * Si además manejás tokens propios, podrías recibir ?token=... y
 * marcarlos como invalidados en DB (tabla sessions o tokens_blacklist).
 */

// (Opcional) leer token enviado por query (?token=...)
$token = isset($_GET['token']) ? $_GET['token'] : '';

// --- Si usás sesiones PHP: destruir ---
try {
  // limpiar variables de sesión
  $_SESSION = [];

  // destruir cookie de sesión del lado cliente
  if (ini_get("session.use_cookies")) {
      $params = session_get_cookie_params();
      setcookie(session_name(), '', time() - 42000,
          $params["path"], $params["domain"],
          $params["secure"], $params["httponly"]
      );
  }

  // destruir sesión en servidor
  session_destroy();
} catch (Throwable $e) {
  // silencioso
}

// (Opcional) si manejás tokens en DB, invalidalos acá usando $token
// try {
//   if ($token) {
//     $stmt = $pdo->prepare("UPDATE sessions SET is_active = 0, closed_at = NOW() WHERE token = ?");
//     $stmt->execute([$token]);
//   }
// } catch (Throwable $e) {}

echo json_encode(['ok' => true, 'message' => 'logged out by page exit']);

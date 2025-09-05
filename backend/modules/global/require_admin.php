<?php
if (session_status() === PHP_SESSION_NONE) { session_start(); }

// Permite fallback por header si aún no usás sesiones cross-origin
$rolHeader = $_SERVER['HTTP_X_USER_ROLE'] ?? null;
$rol = $_SESSION['rol'] ?? $rolHeader ?? 'vista';

if ($rol !== 'admin') {
  http_response_code(403);
  header('Content-Type: application/json');
  echo json_encode(['exito' => false, 'mensaje' => 'Acceso denegado: se requiere rol admin.']);
  exit;
}

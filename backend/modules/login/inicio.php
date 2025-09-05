<?php
require_once __DIR__ . '/../../config/db.php';
if (session_status() === PHP_SESSION_NONE) { session_start(); }

header('Content-Type: application/json');

$input = json_decode(file_get_contents('php://input'), true);
$nombre = trim($input['nombre'] ?? '');
$contrasena = $input['contrasena'] ?? '';

try {
  $stmt = $pdo->prepare("SELECT idUsuario, Nombre_Completo, Hash_Contrasena, rol 
                           FROM usuarios 
                          WHERE Nombre_Completo = :n LIMIT 1");
  $stmt->execute([':n' => $nombre]);
  $u = $stmt->fetch(PDO::FETCH_ASSOC);

  if (!$u || !password_verify($contrasena, $u['Hash_Contrasena'])) {
    echo json_encode(['exito' => false, 'mensaje' => 'Credenciales inválidas']);
    exit;
  }

  // 👉 Guardar en sesión (recomendado)
  $_SESSION['idUsuario'] = (int)$u['idUsuario'];
  $_SESSION['rol']       = $u['rol']; // 'admin' | 'vista'

  echo json_encode([
    'exito'   => true,
    'usuario' => [
      'id'     => (int)$u['idUsuario'],
      'nombre' => $u['Nombre_Completo'],
      'rol'    => $u['rol'],
    ],
    'token' => '' // si no usás token, dejalo vacío
  ]);
} catch (Throwable $e) {
  http_response_code(500);
  echo json_encode(['exito' => false, 'mensaje' => 'Error interno']);
}

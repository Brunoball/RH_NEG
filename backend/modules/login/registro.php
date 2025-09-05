<?php
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Headers: Content-Type');

require_once __DIR__ . '/../../config/db.php';

$data = json_decode(file_get_contents("php://input"), true);
$nombre     = trim($data['nombre'] ?? '');
$contrasena = $data['contrasena'] ?? '';
$rol        = strtolower(trim($data['rol'] ?? 'vista')); // 👈 viene del front; default vista

// Validaciones básicas
if (!$nombre || !$contrasena) {
    echo json_encode(['exito' => false, 'mensaje' => 'Faltan datos.']);
    exit;
}
if (mb_strlen($nombre, 'UTF-8') < 4 || mb_strlen($nombre, 'UTF-8') > 100) {
    echo json_encode(['exito' => false, 'mensaje' => 'El nombre debe tener entre 4 y 100 caracteres.']);
    exit;
}
if (strlen($contrasena) < 6) {
    echo json_encode(['exito' => false, 'mensaje' => 'La contraseña debe tener al menos 6 caracteres.']);
    exit;
}
// Validar rol permitido
$rolesPermitidos = ['admin','vista'];
if (!in_array($rol, $rolesPermitidos, true)) {
    $rol = 'vista'; // fallback seguro
}

// ¿Ya existe? (case-insensitive)
$stmt = $pdo->prepare("SELECT COUNT(*) FROM usuarios WHERE UPPER(Nombre_Completo) = UPPER(:nombre)");
$stmt->execute([':nombre' => $nombre]);
if ($stmt->fetchColumn() > 0) {
    echo json_encode(['exito' => false, 'mensaje' => 'El usuario ya existe.']);
    exit;
}

// Insertar
$hash = password_hash($contrasena, PASSWORD_BCRYPT);

$stmt = $pdo->prepare("
    INSERT INTO usuarios (Nombre_Completo, Hash_Contrasena, rol)
    VALUES (:nombre, :hash, :rol)
");
$ok = $stmt->execute([
    ':nombre' => $nombre,
    ':hash'   => $hash,
    ':rol'    => $rol
]);

if ($ok) {
    $id = (int)$pdo->lastInsertId();
    echo json_encode([
        'exito'   => true,
        'usuario' => [
            'id'     => $id,
            'nombre' => $nombre,
            'rol'    => $rol
        ]
    ]);
} else {
    echo json_encode(['exito' => false, 'mensaje' => 'Error al registrar usuario.']);
}

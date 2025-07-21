<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');

require_once(__DIR__ . '/../../config/db.php');

// Obtener datos del frontend
$data = json_decode(file_get_contents("php://input"), true);
$nombre = trim($data['nombre'] ?? '');
$contrasena = $data['contrasena'] ?? '';

// Validar campos obligatorios
if (!$nombre || !$contrasena) {
    echo json_encode(['exito' => false, 'mensaje' => 'Faltan datos.']);
    exit;
}

// Validar longitud del nombre
if (strlen($nombre) < 4 || strlen($nombre) > 100) {
    echo json_encode(['exito' => false, 'mensaje' => 'El nombre debe tener entre 4 y 100 caracteres.']);
    exit;
}

// Validar longitud de contraseña
if (strlen($contrasena) < 6) {
    echo json_encode(['exito' => false, 'mensaje' => 'La contraseña debe tener al menos 6 caracteres.']);
    exit;
}

// Verificar si el usuario ya existe (ignorando mayúsculas)
$stmt = $pdo->prepare("SELECT COUNT(*) FROM usuarios WHERE UPPER(Nombre_Completo) = UPPER(:nombre)");
$stmt->execute(['nombre' => $nombre]);
if ($stmt->fetchColumn() > 0) {
    echo json_encode(['exito' => false, 'mensaje' => 'El usuario ya existe.']);
    exit;
}

// Hashear contraseña y registrar
$hash = password_hash($contrasena, PASSWORD_BCRYPT);
$stmt = $pdo->prepare("INSERT INTO usuarios (Nombre_Completo, Hash_Contrasena) VALUES (:nombre, :hash)");
$exito = $stmt->execute([
    'nombre' => $nombre,
    'hash' => $hash
]);

if ($exito) {
    echo json_encode([
        'exito' => true,
        'usuario' => ['Nombre_Completo' => $nombre]
    ]);
} else {
    echo json_encode(['exito' => false, 'mensaje' => 'Error al registrar usuario.']);
}

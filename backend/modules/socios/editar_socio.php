<?php
require_once __DIR__ . '/../../config/db.php';

header('Content-Type: application/json');

function aMayus($texto) {
    return isset($texto) && $texto !== '' ? mb_strtoupper(trim($texto), 'UTF-8') : null;
}

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    // Obtener socio por ID
    $id = $_GET['id'] ?? null;

    if (!$id) {
        echo json_encode(['exito' => false, 'mensaje' => 'ID no proporcionado']);
        exit;
    }

    try {
        $stmt = $pdo->prepare("SELECT * FROM socios WHERE id_socio = ?");
        $stmt->execute([$id]);
        $socio = $stmt->fetch(PDO::FETCH_ASSOC);

        if ($socio) {
            echo json_encode(['exito' => true, 'socio' => $socio]);
        } else {
            echo json_encode(['exito' => false, 'mensaje' => 'Socio no encontrado']);
        }
    } catch (PDOException $e) {
        echo json_encode(['exito' => false, 'mensaje' => 'Error: ' . $e->getMessage()]);
    }
} elseif ($_SERVER['REQUEST_METHOD'] === 'POST') {
    // Actualizar socio
    $data = json_decode(file_get_contents("php://input"), true);
    $id = $data['id_socio'] ?? null;

    if (!$id) {
        echo json_encode(['exito' => false, 'mensaje' => 'ID no proporcionado']);
        exit;
    }

    try {
        $campos = [
            'nombre', 'id_cobrador', 'id_categoria', 'domicilio', 'numero',
            'telefono_movil', 'telefono_fijo', 'comentario', 'nacimiento', 'id_estado',
            'domicilio_cobro', 'dni', 'ingreso', 'deuda_2024', 'id_periodo_adeudado'
        ];

        $set = [];
        $valores = [];

        foreach ($campos as $campo) {
            $valor = $data[$campo] ?? null;

            // Convertir a mayúsculas si es texto (excepto campos numéricos o fechas)
            if (in_array($campo, ['nombre', 'domicilio', 'numero', 'telefono_movil', 'telefono_fijo', 'comentario', 'domicilio_cobro', 'deuda_2024'])) {
                $valor = aMayus($valor);
            }

            $set[] = "$campo = ?";
            $valores[] = $valor;
        }

        $valores[] = $id;
        $sql = "UPDATE socios SET " . implode(', ', $set) . " WHERE id_socio = ?";
        $stmt = $pdo->prepare($sql);
        $stmt->execute($valores);

        echo json_encode(['exito' => true, 'mensaje' => 'SOCIO ACTUALIZADO CORRECTAMENTE']);
    } catch (PDOException $e) {
        echo json_encode(['exito' => false, 'mensaje' => 'ERROR AL ACTUALIZAR: ' . $e->getMessage()]);
    }
} else {
    echo json_encode(['exito' => false, 'mensaje' => 'MÉTODO NO PERMITIDO']);
}

<?php
require_once __DIR__ . '/../../config/db.php';

header('Content-Type: application/json');

function aMayus($texto) {
    return (isset($texto) && $texto !== '') ? mb_strtoupper(trim($texto), 'UTF-8') : null;
}

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
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
    $data = json_decode(file_get_contents("php://input"), true);
    $id = $data['id_socio'] ?? null;

    if (!$id) {
        echo json_encode(['exito' => false, 'mensaje' => 'ID no proporcionado']);
        exit;
    }

    try {
        // ✅ Incluimos ultimo_contacto
        $campos = [
            'nombre',
            'id_cobrador',
            'id_categoria',
            'id_cat_monto',
            'domicilio',
            'numero',
            'telefono_movil',
            'telefono_fijo',
            'comentario',
            'ultimo_contacto', // ✅ NUEVO
            'nacimiento',
            'id_estado',
            'domicilio_cobro',
            'dni',
            'ingreso'
        ];

        $set = [];
        $valores = [];

        foreach ($campos as $campo) {
            $valor = $data[$campo] ?? null;

            // Vacío -> NULL
            if ($valor === '') {
                $valor = null;
            }

            // Mayúsculas SOLO en texto
            if (in_array($campo, ['nombre', 'domicilio', 'comentario', 'ultimo_contacto', 'domicilio_cobro'], true)) {
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

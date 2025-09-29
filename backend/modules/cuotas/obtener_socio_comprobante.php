<?php
require_once __DIR__ . '/../../config/db.php';

header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");
header("Content-Type: application/json; charset=utf-8");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

$id = $_GET['id'] ?? null;

if (!$id) {
    echo json_encode(['exito' => false, 'mensaje' => 'ID no proporcionado']);
    exit;
}

try {
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

    // Consulta corregida para obtener correctamente la categoría del socio
    $stmt = $pdo->prepare("
        SELECT 
            s.id_socio,
            s.nombre,
            s.apellido,
            s.domicilio,
            s.numero,
            s.telefono_movil,
            s.telefono_fijo,
            s.domicilio_cobro,
            s.id_periodo,
            s.id_estado,
            s.id_categoria,
            s.id_grupo,

            -- Grupo sanguíneo (si existe en la tabla categoria)
            COALESCE(cat_g.descripcion, '') AS grupo_sanguineo,

            -- Categoría/cuota (esta es la categoría principal del socio)
            COALESCE(cat_c.descripcion, '') AS nombre_categoria,

            -- Estado (ACTIVO/PASIVO)
            COALESCE(e.descripcion, '') AS nombre_estado,

            cb.nombre AS nombre_cobrador,
            p.nombre AS nombre_periodo,
            
            -- Monto de la categoría si existe
            COALESCE(cm.monto, 4000) AS importe
            
        FROM socios s
        LEFT JOIN categoria cat_g ON s.id_grupo = cat_g.id_categoria
        LEFT JOIN categoria cat_c ON s.id_categoria = cat_c.id_categoria
        LEFT JOIN cat_monto cm ON s.id_cat_monto = cm.id_cat_monto
        LEFT JOIN estado e ON s.id_estado = e.id_estado
        LEFT JOIN cobrador cb ON s.id_cobrador = cb.id_cobrador
        LEFT JOIN periodo p ON s.id_periodo = p.id_periodo
        WHERE s.id_socio = ?
        LIMIT 1
    ");
    $stmt->execute([$id]);
    $socio = $stmt->fetch(PDO::FETCH_ASSOC);

    if ($socio) {
        $anio = date('Y');

        // Teléfono: móvil > fijo
        $telefono = '';
        if (!empty($socio['telefono_movil']))      $telefono = trim($socio['telefono_movil']);
        elseif (!empty($socio['telefono_fijo']))   $telefono = trim($socio['telefono_fijo']);

        // Período visible
        $periodoTexto = '';
        if (!empty($socio['nombre_periodo'])) {
            $periodoTexto = $socio['nombre_periodo'];
        } elseif (!empty($socio['id_periodo'])) {
            $periodoTexto = "PERÍODO: {$socio['id_periodo']} / {$anio}";
        }

        echo json_encode([
            'exito' => true,
            'socio' => [
                'id_socio'         => $socio['id_socio'] ?? '',
                'nombre'           => $socio['nombre'] ?? '',
                'apellido'         => $socio['apellido'] ?? '',
                'domicilio'        => $socio['domicilio'] ?? '',
                'numero'           => $socio['numero'] ?? '',
                'domicilio_cobro'  => trim($socio['domicilio_cobro'] ?? ''),
                'telefono'         => $telefono,
                'periodo_texto'    => $periodoTexto,

                'id_estado'        => isset($socio['id_estado']) ? (int)$socio['id_estado'] : null,
                'nombre_estado'    => $socio['nombre_estado'] ?? '',

                // Información de categoría (corregido)
                'id_categoria'     => isset($socio['id_categoria']) ? (int)$socio['id_categoria'] : null,
                'nombre_categoria' => $socio['nombre_categoria'] ?? '',

                // Información de grupo sanguíneo
                'id_grupo'         => isset($socio['id_grupo']) ? (int)$socio['id_grupo'] : null,
                'grupo_sanguineo'  => $socio['grupo_sanguineo'] ?? '',

                'importe'          => $socio['importe'] ?? 4000,
                'importe_total'    => $socio['importe'] ?? 4000,
                'nombre_cobrador'  => $socio['nombre_cobrador'] ?? ''
            ]
        ], JSON_UNESCAPED_UNICODE);
    } else {
        echo json_encode(['exito' => false, 'mensaje' => 'Socio no encontrado']);
    }
} catch (PDOException $e) {
    echo json_encode(['exito' => false, 'mensaje' => 'Error de servidor: ' . $e->getMessage()]);
}
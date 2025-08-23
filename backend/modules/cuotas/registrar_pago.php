<?php
require_once __DIR__ . '/../../config/db.php';

header("Access-Control-Allow-Origin: http://localhost:3000");
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");
header('Content-Type: application/json');

// Preflight CORS
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// Validar método
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    echo json_encode(['exito' => false, 'mensaje' => 'Método no permitido']);
    exit;
}

// Leer entrada
$input     = json_decode(file_get_contents("php://input"), true) ?? [];
$id_socio  = $input['id_socio']  ?? null;
$periodos  = $input['periodos']  ?? [];
$condonar  = !empty($input['condonar']); // true = condonar, false = pagar

if (!$id_socio || !is_array($periodos) || empty($periodos)) {
    echo json_encode(['exito' => false, 'mensaje' => 'Datos incompletos para registrar']);
    exit;
}

try {
    $pdo->beginTransaction();

    // Consultas preparadas
    // IMPORTANTE: si tenés campo "anulado", agregá AND anulado = 0 al SELECT
    $sel = $pdo->prepare("
        SELECT id_pago, estado, fecha_pago
          FROM pagos
         WHERE id_socio = ? AND id_periodo = ?
         LIMIT 1
    ");

    $ins = $pdo->prepare("
        INSERT INTO pagos (id_socio, id_periodo, fecha_pago, estado)
        VALUES (?, ?, ?, ?)
    ");

    $hoy = date('Y-m-d');
    $nuevoEstado = $condonar ? 'condonado' : 'pagado';

    $insertados = [];         // periodos que se insertaron ok
    $yaRegistrados = [];      // periodos que ya tenían registro (pagado/condonado)
    $errores = [];            // por si alguno falla individualmente

    foreach ($periodos as $id_periodo) {
        $id_periodo = (int)$id_periodo;

        // 1) Verificar si ya existe registro para ese socio/periodo
        $sel->execute([$id_socio, $id_periodo]);
        $row = $sel->fetch(PDO::FETCH_ASSOC);

        if ($row) {
            // Ya estaba registrado: NO actualizamos (idempotencia)
            // y devolvemos aviso indicando su estado actual
            $yaRegistrados[] = [
                'periodo' => $id_periodo,
                'estado'  => $row['estado'] ?: 'pagado'
            ];
            continue;
        }

        // 2) Insertar nuevo registro
        try {
            $ins->execute([$id_socio, $id_periodo, $hoy, $nuevoEstado]);
            $insertados[] = $id_periodo;
        } catch (Throwable $e) {
            $errores[] = [
                'periodo' => $id_periodo,
                'mensaje' => $e->getMessage()
            ];
        }
    }

    // Si todo ok, commit
    $pdo->commit();

    // Armar respuesta amigable
    $accion = $condonar ? 'condonación' : 'pago';

    // Caso 1: no se insertó nada y había duplicados => operación rechazada
    if (empty($insertados) && !empty($yaRegistrados) && empty($errores)) {
        // Construir mensaje indicando qué estados tenía
        $detalles = array_map(function ($it) {
            $txt = strtoupper($it['estado']);
            return "{$it['periodo']} ({$txt})";
        }, $yaRegistrados);

        echo json_encode([
            'exito'   => false,
            'mensaje' => 'El/los período(s) ya fue/fueron registrado(s) anteriormente: ' . implode(', ', $detalles),
            'ya_registrados' => $yaRegistrados
        ]);
        exit;
    }

    // Caso 2: hubo inserciones (y quizás algunos ya estaban)
    $msg = ucfirst($accion) . ' registrada correctamente';
    $info = [
        'exito'         => true,
        'mensaje'       => $msg,
        'insertados'    => $insertados,
        'ya_registrados'=> $yaRegistrados,
        'errores'       => $errores
    ];

    // Si hubo errores individuales, cambiamos el mensaje para que el front lo avise
    if (!empty($errores)) {
        $info['exito']   = false; // marcar como no completamente exitosa
        $info['mensaje'] = 'Algunos períodos no pudieron registrarse';
    }

    echo json_encode($info);
} catch (Throwable $e) {
    if ($pdo->inTransaction()) $pdo->rollBack();
    echo json_encode([
        'exito' => false,
        'mensaje' => 'Error al registrar: ' . $e->getMessage()
    ]);
}

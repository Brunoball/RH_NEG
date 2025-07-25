<?php
require_once __DIR__ . '/../../config/db.php';
header('Content-Type: application/json');

try {
    $stmt = $pdo->prepare("
        SELECT 
            s.id_socio,
            s.nombre,
            s.domicilio,
            s.numero,
            s.domicilio_cobro,
            c.nombre AS cobrador,
            e.descripcion AS estado
        FROM socios s
        LEFT JOIN cobrador c ON s.id_cobrador = c.id_cobrador
        LEFT JOIN estado e ON s.id_estado = e.id_estado
        WHERE s.activo = 1
        ORDER BY s.nombre ASC
    ");
    $stmt->execute();
    $socios = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // Ahora obtenemos todos los pagos
    $pagosStmt = $pdo->prepare("SELECT id_socio, id_periodo FROM pagos");
    $pagosStmt->execute();
    $pagos = $pagosStmt->fetchAll(PDO::FETCH_ASSOC);

    $pagosPorSocio = [];
    foreach ($pagos as $pago) {
        $pagosPorSocio[$pago['id_socio']][] = $pago['id_periodo'];
    }

    $cuotas = [];

    foreach ($socios as $socio) {
        $id = $socio['id_socio'];
        $pagosHechos = $pagosPorSocio[$id] ?? [];

        // Para cada período del 1 al 6
        for ($periodo = 1; $periodo <= 6; $periodo++) {
            $pagado = in_array($periodo, $pagosHechos);

            $domicilioFinal = '';
            if (!empty($socio['domicilio_cobro'])) {
                $domicilioFinal = $socio['domicilio_cobro'];
            } elseif (!empty($socio['domicilio']) || !empty($socio['numero'])) {
                $domicilioFinal = trim(($socio['domicilio'] ?? '') . ' ' . ($socio['numero'] ?? ''));
            }

            $cuotas[] = [
                'id_socio'     => $id,
                'nombre'       => $socio['nombre'],
                'domicilio'    => $domicilioFinal,
                'estado'       => $socio['estado'] ?? 'No definido',
                'medio_pago'   => $socio['cobrador'] ?? 'No definido',
                'mes'          => "Período $periodo",
                'id_periodo'   => $periodo,
                'estado_pago'  => $pagado ? 'pagado' : 'deudor'
            ];
        }
    }

    echo json_encode([
        'exito' => true,
        'cuotas' => $cuotas
    ]);
} catch (PDOException $e) {
    echo json_encode([
        'exito' => false,
        'mensaje' => 'Error al obtener cuotas: ' . $e->getMessage()
    ]);
}

<?php
// backend/modules/socios/editar_socio.php

declare(strict_types=1);

require_once __DIR__ . '/../../config/db.php';

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
header('Pragma: no-cache');
header('Expires: 0');

function responder(array $payload, int $status = 200): void
{
    http_response_code($status);
    echo json_encode($payload, JSON_UNESCAPED_UNICODE);
    exit;
}

function aMayus(?string $texto): ?string
{
    $texto = trim((string) $texto);

    if ($texto === '') {
        return null;
    }

    return mb_strtoupper($texto, 'UTF-8');
}

function normalizarValor($valor)
{
    if ($valor === '') {
        return null;
    }

    return $valor;
}

function normalizarEntero($valor): ?int
{
    if ($valor === null || $valor === '') {
        return null;
    }

    if (!is_numeric($valor)) {
        return null;
    }

    return (int) $valor;
}

function normalizarFecha($valor): ?string
{
    $valor = trim((string) $valor);

    if ($valor === '') {
        return null;
    }

    if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $valor)) {
        return null;
    }

    return $valor;
}

try {
    if (!($pdo instanceof PDO)) {
        responder([
            'exito' => false,
            'mensaje' => 'Conexión PDO no disponible.',
        ], 500);
    }

    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

    if ($_SERVER['REQUEST_METHOD'] === 'GET') {
        $id = isset($_GET['id']) ? (int) $_GET['id'] : 0;

        if ($id <= 0) {
            responder([
                'exito' => false,
                'mensaje' => 'ID no proporcionado.',
            ], 422);
        }

        /*
            IMPORTANTE:
            La tabla socios NO tiene columna ultimo_contacto.
            Por eso se obtiene el último contacto mediante id_ultimo_contacto
            y se aliasa para que el frontend pueda seguir usando:
            - ultimo_contacto
            - ultimo_contacto_fecha
            - ultimo_contacto_estado
        */
        $stmt = $pdo->prepare("
            SELECT
                s.*,

                sc.id_contacto AS contacto_id,
                sc.detalle_contacto AS ultimo_contacto,
                sc.fecha_contacto AS ultimo_contacto_fecha,
                sc.estado_contacto AS ultimo_contacto_estado,

                f.nombre_familia AS familia,
                e.descripcion AS estado_descripcion

            FROM socios s

            LEFT JOIN socios_contactos sc
                ON sc.id_contacto = s.id_ultimo_contacto

            LEFT JOIN familias f
                ON f.id_familia = s.id_familia

            LEFT JOIN estado e
                ON e.id_estado = s.id_estado

            WHERE s.id_socio = :id_socio
            LIMIT 1
        ");

        $stmt->execute([
            ':id_socio' => $id,
        ]);

        $socio = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$socio) {
            responder([
                'exito' => false,
                'mensaje' => 'Socio no encontrado.',
            ], 404);
        }

        responder([
            'exito' => true,
            'socio' => $socio,
        ]);
    }

    if ($_SERVER['REQUEST_METHOD'] === 'POST') {
        $data = json_decode(file_get_contents('php://input'), true);

        if (!is_array($data)) {
            responder([
                'exito' => false,
                'mensaje' => 'Datos inválidos.',
            ], 422);
        }

        $id = isset($data['id_socio']) ? (int) $data['id_socio'] : 0;

        if ($id <= 0) {
            responder([
                'exito' => false,
                'mensaje' => 'ID no proporcionado.',
            ], 422);
        }

        $stmtExiste = $pdo->prepare("
            SELECT id_socio
            FROM socios
            WHERE id_socio = :id_socio
            LIMIT 1
        ");
        $stmtExiste->execute([
            ':id_socio' => $id,
        ]);

        if (!$stmtExiste->fetch(PDO::FETCH_ASSOC)) {
            responder([
                'exito' => false,
                'mensaje' => 'Socio no encontrado.',
            ], 404);
        }

        /*
            Campos reales de la tabla socios según tu DESCRIBE:

            id_socio
            nombre
            id_cobrador
            id_categoria
            id_cat_monto
            domicilio
            numero
            telefono_movil
            telefono_fijo
            comentario
            id_ultimo_contacto
            nacimiento
            id_estado
            domicilio_cobro
            dni
            ingreso
            activo
            motivo
            id_familia

            NO EXISTE:
            ultimo_contacto

            Por eso NO se incluye ultimo_contacto en el UPDATE.
            Los contactos se guardan en actualizar_contacto_socio.php.
        */

        $nombre = aMayus($data['nombre'] ?? null);

        if (!$nombre) {
            responder([
                'exito' => false,
                'mensaje' => 'El nombre es obligatorio.',
            ], 422);
        }

        $idCobrador = normalizarEntero($data['id_cobrador'] ?? null);
        $idCategoria = normalizarEntero($data['id_categoria'] ?? null);
        $idCatMonto = normalizarEntero($data['id_cat_monto'] ?? null);
        $idEstado = normalizarEntero($data['id_estado'] ?? null);
        $idFamilia = normalizarEntero($data['id_familia'] ?? null);

        $domicilio = aMayus($data['domicilio'] ?? null);
        $numero = normalizarValor(trim((string) ($data['numero'] ?? '')));
        $telefonoMovil = normalizarValor(trim((string) ($data['telefono_movil'] ?? '')));
        $telefonoFijo = normalizarValor(trim((string) ($data['telefono_fijo'] ?? '')));
        $comentario = aMayus($data['comentario'] ?? null);
        $domicilioCobro = aMayus($data['domicilio_cobro'] ?? null);
        $motivo = aMayus($data['motivo'] ?? null);

        $nacimiento = normalizarFecha($data['nacimiento'] ?? '');
        $ingreso = normalizarFecha($data['ingreso'] ?? '');

        $dniRaw = trim((string) ($data['dni'] ?? ''));
        $dni = $dniRaw !== '' && is_numeric($dniRaw) ? $dniRaw : null;

        $activo = isset($data['activo']) && $data['activo'] !== ''
            ? (int) $data['activo']
            : 1;

        $sql = "
            UPDATE socios
            SET
                nombre = :nombre,
                id_cobrador = :id_cobrador,
                id_categoria = :id_categoria,
                id_cat_monto = :id_cat_monto,
                domicilio = :domicilio,
                numero = :numero,
                telefono_movil = :telefono_movil,
                telefono_fijo = :telefono_fijo,
                comentario = :comentario,
                nacimiento = :nacimiento,
                id_estado = :id_estado,
                domicilio_cobro = :domicilio_cobro,
                dni = :dni,
                ingreso = :ingreso,
                activo = :activo,
                motivo = :motivo,
                id_familia = :id_familia
            WHERE id_socio = :id_socio
            LIMIT 1
        ";

        $stmt = $pdo->prepare($sql);

        $stmt->execute([
            ':nombre' => $nombre,
            ':id_cobrador' => $idCobrador,
            ':id_categoria' => $idCategoria,
            ':id_cat_monto' => $idCatMonto,
            ':domicilio' => $domicilio,
            ':numero' => $numero,
            ':telefono_movil' => $telefonoMovil,
            ':telefono_fijo' => $telefonoFijo,
            ':comentario' => $comentario,
            ':nacimiento' => $nacimiento,
            ':id_estado' => $idEstado,
            ':domicilio_cobro' => $domicilioCobro,
            ':dni' => $dni,
            ':ingreso' => $ingreso,
            ':activo' => $activo,
            ':motivo' => $motivo,
            ':id_familia' => $idFamilia,
            ':id_socio' => $id,
        ]);

        responder([
            'exito' => true,
            'mensaje' => 'SOCIO ACTUALIZADO CORRECTAMENTE.',
        ]);
    }

    responder([
        'exito' => false,
        'mensaje' => 'MÉTODO NO PERMITIDO.',
    ], 405);

} catch (Throwable $e) {
    responder([
        'exito' => false,
        'mensaje' => 'ERROR AL ACTUALIZAR: ' . $e->getMessage(),
    ], 500);
}
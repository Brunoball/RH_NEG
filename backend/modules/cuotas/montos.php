<?php
require_once __DIR__ . '/../../config/db.php';
header('Content-Type: application/json; charset=utf-8');

/**
 * Devuelve montos (mensual y anual) según:
 *   - id_cat_monto recibido, o
 *   - id_socio recibido (busca su id_cat_monto en socios),
 *   - y si nada llega/encuentra, cae al último registro disponible.
 *
 * Respuesta OK:
 *   { exito:true, mensual:<int>, anual:<int>, id_cat_monto:<int|null>, nombre_categoria:<string|null> }
 *
 * Errores:
 *   { exito:false, mensaje:"..." }
 */

function readInt($arr, $key) {
    if (!isset($arr[$key])) return null;
    $v = trim((string)$arr[$key]);
    return ctype_digit($v) ? (int)$v : null;
}

function fetchCatForSocio(PDO $pdo, string $sociosFqn, int $idSocio): ?int {
    $sql = "SELECT id_cat_monto FROM {$sociosFqn} WHERE id_socio = :id LIMIT 1";
    $st  = $pdo->prepare($sql);
    $st->execute([':id' => $idSocio]);
    $val = $st->fetchColumn();
    return $val !== false ? (int)$val : null;
}

function fetchMontosByCat(PDO $pdo, string $catFqn, int $idCat): ?array {
    // En tu esquema actual hay 1 fila por categoría.
    // Dejamos ORDER por si a futuro guardás histórico por fecha_creacion.
    $sql = "
        SELECT id_cat_monto, nombre_categoria, monto_mensual, monto_anual
          FROM {$catFqn}
         WHERE id_cat_monto = :id
      ORDER BY fecha_creacion DESC, id_cat_monto DESC
         LIMIT 1
    ";
    $st = $pdo->prepare($sql);
    $st->execute([':id' => $idCat]);
    $row = $st->fetch(PDO::FETCH_ASSOC);
    return $row ?: null;
}

function fetchMontosFallback(PDO $pdo, string $catFqn): ?array {
    $sql = "
        SELECT id_cat_monto, nombre_categoria, monto_mensual, monto_anual
          FROM {$catFqn}
      ORDER BY fecha_creacion DESC, id_cat_monto DESC
         LIMIT 1
    ";
    $row = $pdo->query($sql)->fetch(PDO::FETCH_ASSOC);
    return $row ?: null;
}

try {
    $idCatReq   = readInt($_GET, 'id_cat_monto') ?? readInt($_POST, 'id_cat_monto');
    $idSocioReq = readInt($_GET, 'id_socio')     ?? readInt($_POST, 'id_socio');

    $row = null;
    $idCatFinal = null;

    // Probamos primero sin esquema y luego con esquema completo.
    $catTables   = ['categoria_monto', 'rh_neg.categoria_monto'];
    $sociosTables= ['socios', 'rh_neg.socios'];

    // 1) Resolver id_cat_monto a partir de lo recibido
    if ($idCatReq !== null) {
        $idCatFinal = $idCatReq;
    } elseif ($idSocioReq !== null) {
        foreach ($sociosTables as $socFqn) {
            try {
                $idCatFinal = fetchCatForSocio($pdo, $socFqn, $idSocioReq);
                if ($idCatFinal !== null) break;
            } catch (Throwable $e) {
                // Intentamos con el siguiente FQN
            }
        }
    }

    // 2) Buscar montos por la categoría resuelta
    if ($idCatFinal !== null) {
        foreach ($catTables as $catFqn) {
            try {
                $row = fetchMontosByCat($pdo, $catFqn, $idCatFinal);
                if ($row) break;
            } catch (Throwable $e) {
                // Intentamos el próximo FQN
            }
        }
    }

    // 3) Fallback: último registro disponible (por si no llegó nada)
    if (!$row) {
        foreach ($catTables as $catFqn) {
            try {
                $row = fetchMontosFallback($pdo, $catFqn);
                if ($row) {
                    $idCatFinal = isset($row['id_cat_monto']) ? (int)$row['id_cat_monto'] : null;
                    break;
                }
            } catch (Throwable $e) {
                // Intentamos con el siguiente FQN
            }
        }
    }

    if ($row) {
        echo json_encode([
            'exito'            => true,
            'mensual'          => (int)($row['monto_mensual'] ?? 0),
            'anual'            => (int)($row['monto_anual'] ?? 0),
            'id_cat_monto'     => $idCatFinal,
            'nombre_categoria' => $row['nombre_categoria'] ?? null,
        ], JSON_UNESCAPED_UNICODE);
        exit;
    }

    echo json_encode([
        'exito'   => false,
        'mensaje' => 'No se encontraron montos configurados.',
    ], JSON_UNESCAPED_UNICODE);
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode([
        'exito'   => false,
        'mensaje' => 'Error al obtener montos: ' . $e->getMessage(),
    ], JSON_UNESCAPED_UNICODE);
}

import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import BASE_URL from '../../config/config';
import './Socios.css';

const EditarSocio = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    nombre: '',
    id_cobrador: '',
    id_categoria: '',
    domicilio: '',
    numero: '',
    telefono_movil: '',
    telefono_fijo: '',
    comentario: '',
    nacimiento: '',
    id_estado: '',
    domicilio_cobro: '',
    dni: '',
    ingreso: '',
    deuda_2024: '',
    id_periodo_adeudado: ''
  });

  const [listas, setListas] = useState({ categorias: [], cobradores: [], estados: [] });
  const [mensaje, setMensaje] = useState('');
  const [datosOriginales, setDatosOriginales] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSocio = async () => {
      try {
        const res = await fetch(`${BASE_URL}/api.php?action=editar_socio&id=${id}`);
        const data = await res.json();
        if (data.exito) {
          const socioFormateado = {};
          for (const key in formData) {
            socioFormateado[key] = data.socio[key] ?? '';
          }
          setFormData(socioFormateado);
          setDatosOriginales(socioFormateado);
          setLoading(false);
        } else {
          alert('❌ Error al cargar el socio: ' + data.mensaje);
        }
      } catch (err) {
        alert('❌ Error de red: ' + err);
      }
    };

    const fetchListas = async () => {
      try {
        const res = await fetch(`${BASE_URL}/api.php?action=listas`);
        const json = await res.json();
        if (json.exito) setListas(json.listas);
        else alert('❌ Error al cargar listas: ' + json.mensaje);
      } catch (err) {
        alert('❌ Error al conectar con el servidor para obtener listas');
      }
    };

    fetchListas();
    fetchSocio();
  }, [id]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    let valor = typeof value === 'string' ? value.toUpperCase() : value;
    setFormData((prev) => ({
      ...prev,
      [name]: valor,
    }));
  };

  const mostrarMensajeTemporal = (texto) => {
    setMensaje(texto);
    setTimeout(() => setMensaje(''), 2500);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const sinCambios = JSON.stringify(formData) === JSON.stringify(datosOriginales);
    if (sinCambios) {
      mostrarMensajeTemporal('⚠️ No se encontraron cambios para realizar');
      return;
    }

    try {
      const res = await fetch(`${BASE_URL}/api.php?action=editar_socio`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...formData, id_socio: id }),
      });

      const data = await res.json();
      if (data.exito) {
        mostrarMensajeTemporal('✅ Socio actualizado correctamente');
        setTimeout(() => navigate('/socios'), 2500);
      } else {
        alert('Error al actualizar: ' + data.mensaje);
      }
    } catch (error) {
      alert('Error de red: ' + error);
    }
  };

  return (
    <div className="formulario-container">
      <h2>Editar Socio #{id}</h2>
      {mensaje && <div className="mensaje-exito">{mensaje}</div>}

      {loading ? (
        <div className="spinner">Cargando...</div> // podés poner tu spinner animado aquí
      ) : (
        <form onSubmit={handleSubmit} className="formulario-socio">
          <div className="campo-formulario">
            <input
              name="nombre"
              value={formData.nombre || ''}
              onChange={handleChange}
              placeholder="Nombre completo"
            />
          </div>

          <div className="campo-formulario">
            <select name="id_cobrador" value={formData.id_cobrador || ''} onChange={handleChange}>
              <option value="">Seleccione Cobrador</option>
              {listas.cobradores.map(c => (
                <option key={c.id} value={c.id}>{c.nombre}</option>
              ))}
            </select>
          </div>

          <div className="campo-formulario">
            <select name="id_categoria" value={formData.id_categoria || ''} onChange={handleChange}>
              <option value="">Seleccione Categoría</option>
              {listas.categorias.map(c => (
                <option key={c.id} value={c.id}>{c.descripcion}</option>
              ))}
            </select>
          </div>

          <div className="campo-formulario">
            <input name="domicilio" value={formData.domicilio || ''} onChange={handleChange} placeholder="Domicilio" />
          </div>

          <div className="campo-formulario">
            <input name="numero" value={formData.numero || ''} onChange={handleChange} placeholder="Número" />
          </div>

          <div className="campo-formulario">
            <input name="telefono_movil" value={formData.telefono_movil || ''} onChange={handleChange} placeholder="Teléfono Móvil" />
          </div>

          <div className="campo-formulario">
            <input name="telefono_fijo" value={formData.telefono_fijo || ''} onChange={handleChange} placeholder="Teléfono Fijo" />
          </div>

          <div className="campo-formulario">
            <input name="comentario" value={formData.comentario || ''} onChange={handleChange} placeholder="Comentario" />
          </div>

          <div className="campo-formulario">
            <label className="label-fecha">
              Fecha de nacimiento
              <input type="date" name="nacimiento" value={formData.nacimiento || ''} onChange={handleChange} />
            </label>
          </div>

          <div className="campo-formulario">
            <select name="id_estado" value={formData.id_estado || ''} onChange={handleChange}>
              <option value="">Seleccione Estado</option>
              {listas.estados.map(e => (
                <option key={e.id} value={e.id}>{e.descripcion}</option>
              ))}
            </select>
          </div>

          <div className="campo-formulario">
            <input name="domicilio_cobro" value={formData.domicilio_cobro || ''} onChange={handleChange} placeholder="Domicilio de Cobro" />
          </div>

          <div className="campo-formulario">
            <input name="dni" value={formData.dni || ''} onChange={handleChange} placeholder="DNI" />
          </div>

          <div className="campo-formulario">
            <input name="ingreso" value={formData.ingreso || ''} onChange={handleChange} placeholder="Ingreso" />
          </div>

          <div className="campo-formulario">
            <input name="deuda_2024" value={formData.deuda_2024 || ''} onChange={handleChange} placeholder="Deuda 2024" />
          </div>

          <div className="campo-formulario">
            <input name="id_periodo_adeudado" value={formData.id_periodo_adeudado || ''} onChange={handleChange} placeholder="Periodo Adeudado" />
          </div>

          <div className="botones-formulario">
            <button type="submit">Guardar Cambios</button>
            <button type="button" onClick={() => navigate('/socios')}>Cancelar</button>
          </div>
        </form>
      )}
    </div>
  );
};

export default EditarSocio;

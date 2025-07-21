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

  useEffect(() => {
    const fetchSocio = async () => {
      try {
        const res = await fetch(`${BASE_URL}/api.php?action=editar_socio&id=${id}`);
        const data = await res.json();
        if (data.exito) setFormData(data.socio);
        else alert('❌ Error al cargar el socio: ' + data.mensaje);
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
        console.error(err);
        alert('❌ Error al conectar con el servidor para obtener listas');
      }
    };

    fetchSocio();
    fetchListas();
  }, [id]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    let valor = value.toUpperCase();
    setFormData((prev) => ({
      ...prev,
      [name]: valor,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`${BASE_URL}/api.php?action=editar_socio`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...formData, id_socio: id }),
      });

      const data = await res.json();
      if (data.exito) {
        setMensaje('✅ Socio actualizado correctamente');
        setTimeout(() => navigate('/socios'), 2000);
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
      <form onSubmit={handleSubmit} className="formulario-socio">
        <div className="campo-formulario">
          <input
            name="nombre"
            value={formData.nombre}
            onChange={handleChange}
            placeholder="Nombre completo"
          />
        </div>

        <div className="campo-formulario">
          <select name="id_cobrador" value={formData.id_cobrador} onChange={handleChange}>
            <option value="">Seleccione Cobrador</option>
            {listas.cobradores.map(c => (
              <option key={c.id} value={c.id}>{c.nombre}</option>
            ))}
          </select>
        </div>

        <div className="campo-formulario">
          <select name="id_categoria" value={formData.id_categoria} onChange={handleChange}>
            <option value="">Seleccione Categoría</option>
            {listas.categorias.map(c => (
              <option key={c.id} value={c.id}>{c.descripcion}</option>
            ))}
          </select>
        </div>

        <div className="campo-formulario">
          <input name="domicilio" value={formData.domicilio} onChange={handleChange} placeholder="Domicilio" />
        </div>

        <div className="campo-formulario">
          <input name="numero" value={formData.numero} onChange={handleChange} placeholder="Número" />
        </div>

        <div className="campo-formulario">
          <input name="telefono_movil" value={formData.telefono_movil} onChange={handleChange} placeholder="Teléfono Móvil" />
        </div>

        <div className="campo-formulario">
          <input name="telefono_fijo" value={formData.telefono_fijo} onChange={handleChange} placeholder="Teléfono Fijo" />
        </div>

        <div className="campo-formulario">
          <input name="comentario" value={formData.comentario} onChange={handleChange} placeholder="Comentario" />
        </div>

        <div className="campo-formulario">
          <label className="label-fecha">
            Fecha de nacimiento
            <input type="date" name="nacimiento" value={formData.nacimiento} onChange={handleChange} />
          </label>
        </div>

        <div className="campo-formulario">
          <select name="id_estado" value={formData.id_estado} onChange={handleChange}>
            <option value="">Seleccione Estado</option>
            {listas.estados.map(e => (
              <option key={e.id} value={e.id}>{e.descripcion}</option>
            ))}
          </select>
        </div>

        <div className="campo-formulario">
          <input name="domicilio_cobro" value={formData.domicilio_cobro} onChange={handleChange} placeholder="Domicilio de Cobro" />
        </div>

        <div className="campo-formulario">
          <input name="dni" value={formData.dni} onChange={handleChange} placeholder="DNI" />
        </div>

        <div className="botones-formulario">
          <button type="submit">Guardar Cambios</button>
          <button type="button" onClick={() => navigate('/socios')}>Cancelar</button>
        </div>
      </form>
    </div>
  );
};

export default EditarSocio;

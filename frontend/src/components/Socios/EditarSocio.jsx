import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSave, faArrowLeft } from '@fortawesome/free-solid-svg-icons';
import BASE_URL from '../../config/config';
import './EditarSocio.css';

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
  const [datosOriginales, setDatosOriginales] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errores, setErrores] = useState({});
  const [mostrarErrores, setMostrarErrores] = useState(false);

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

  const validarCampo = (name, value) => {
    const soloNumeros = /^[0-9]+$/;
    const textoValido = /^[A-ZÑa-zñáéíóúÁÉÍÓÚ0-9\s.,-]*$/;

    switch (name) {
      case 'dni':
      case 'numero':
      case 'telefono_movil':
      case 'telefono_fijo':
      case 'deuda_2024':
      case 'id_periodo_adeudado':
        if (value && !soloNumeros.test(value)) return '❌ Solo se permiten números';
        if (value.length > 20) return '❌ Máximo 20 caracteres';
        break;
      case 'nombre':
      case 'domicilio':
      case 'domicilio_cobro':
        if (value && !textoValido.test(value)) {
          return '❌ Solo se permiten letras, números, espacios, puntos, comas, guiones y Ñ';
        }
        if (value.length > 100) return '❌ Máximo 100 caracteres';
        break;
      case 'comentario':
        if (value && !textoValido.test(value)) {
          return '❌ Solo se permiten letras, números, espacios, puntos, comas, guiones y Ñ';
        }
        if (value.length > 100) return '❌ Máximo 100 caracteres';
        break;
      default:
        return null;
    }
    return null;
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    const valor = typeof value === 'string' ? value.toUpperCase() : value;
    setFormData((prev) => ({
      ...prev,
      [name]: valor,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMostrarErrores(true);
    const nuevosErrores = {};

    if (!formData.nombre.trim()) nuevosErrores.nombre = '⚠️ El nombre es obligatorio';

    Object.entries(formData).forEach(([key, value]) => {
      const error = validarCampo(key, value);
      if (error) nuevosErrores[key] = error;
    });

    if (Object.keys(nuevosErrores).length > 0) {
      setErrores(nuevosErrores);
      return;
    }

    const sinCambios = JSON.stringify(formData) === JSON.stringify(datosOriginales);
    if (sinCambios) {
      alert('ℹ️ No se encontraron cambios para realizar');
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
        alert('✅ Socio actualizado correctamente');
        setTimeout(() => navigate('/socios'), 1000);
      } else {
        if (data.errores) setErrores(data.errores);
        else alert('❌ Error: ' + data.mensaje);
      }
    } catch (error) {
      alert('❌ Error de red: ' + error);
    }
  };

  if (loading) {
    return (
      <div className="editsoc-container">
        <div className="editsoc-loader"></div>
        <p className="editsoc-loading-text">Cargando socio...</p>
      </div>
    );
  }

  return (
    <div className="editsoc-container">
      <h2>Editar Socio #{id}</h2>
      <form className="editsoc-form" onSubmit={handleSubmit}>
        {[
          { name: 'nombre', label: 'Nombre completo *', type: 'text' },
          { name: 'domicilio', label: 'Domicilio', type: 'text' },
          { name: 'numero', label: 'Número', type: 'text' },
          { name: 'telefono_movil', label: 'Teléfono Móvil', type: 'text' },
          { name: 'telefono_fijo', label: 'Teléfono Fijo', type: 'text' },
          { name: 'domicilio_cobro', label: 'Domicilio de Cobro', type: 'text' },
          { name: 'dni', label: 'DNI', type: 'text' },
          { name: 'deuda_2024', label: 'Deuda 2024', type: 'text' },
          { name: 'id_periodo_adeudado', label: 'Periodo Adeudado', type: 'text' },
        ].map(({ name, label, type }) => (
          <div className="editsoc-field" key={name}>
            <div className="editsoc-input-container">
              <input
                name={name}
                type={type}
                value={formData[name]}
                onChange={handleChange}
                className={formData[name] ? 'editsoc-input-filled' : ''}
              />
              <label className="editsoc-floating-label">{label}</label>
            </div>
            {mostrarErrores && errores[name] && (
              <span className="editsoc-error">{errores[name]}</span>
            )}
          </div>
        ))}

        <div className="editsoc-field">
          <div className="editsoc-input-container">
            <select 
              name="id_cobrador" 
              onChange={handleChange}
              value={formData.id_cobrador}
              className={formData.id_cobrador ? 'editsoc-input-filled' : ''}
            >
              <option value=""></option>
              {listas.cobradores.map(c => (
                <option key={c.id} value={c.id}>{c.nombre}</option>
              ))}
            </select>
            <label className="editsoc-floating-label">Seleccione Cobrador</label>
          </div>
        </div>

        <div className="editsoc-field">
          <div className="editsoc-input-container">
            <select 
              name="id_categoria" 
              onChange={handleChange}
              value={formData.id_categoria}
              className={formData.id_categoria ? 'editsoc-input-filled' : ''}
            >
              <option value=""></option>
              {listas.categorias.map(c => (
                <option key={c.id} value={c.id}>{c.descripcion}</option>
              ))}
            </select>
            <label className="editsoc-floating-label">Seleccione Categoría</label>
          </div>
        </div>

        <div className="editsoc-field">
          <div className="editsoc-input-container editsoc-date-container">
            <input 
              name="nacimiento" 
              type="date" 
              onChange={handleChange}
              value={formData.nacimiento}
              className="editsoc-input-filled"
            />
            <label className="editsoc-floating-label">Fecha de nacimiento</label>
          </div>
        </div>

        <div className="editsoc-field">
          <div className="editsoc-input-container editsoc-date-container">
            <input 
              name="ingreso" 
              type="date" 
              onChange={handleChange}
              value={formData.ingreso}
              className="editsoc-input-filled"
            />
            <label className="editsoc-floating-label">Fecha de Ingreso</label>
          </div>
        </div>

        <div className="editsoc-field">
          <div className="editsoc-input-container">
            <select 
              name="id_estado" 
              onChange={handleChange}
              value={formData.id_estado}
              className={formData.id_estado ? 'editsoc-input-filled' : ''}
            >
              <option value=""></option>
              {listas.estados.map(e => (
                <option key={e.id} value={e.id}>{e.descripcion}</option>
              ))}
            </select>
            <label className="editsoc-floating-label">Seleccione Estado</label>
          </div>
        </div>

        <div className="editsoc-field editsoc-comment-field" style={{ gridColumn: '1 / -1' }}>
          <div className="editsoc-input-container editsoc-comment-container">
            <input
              name="comentario"
              value={formData.comentario}
              onChange={handleChange}
              className={formData.comentario ? 'editsoc-input-filled' : ''}
            />
            <label className="editsoc-floating-label">Comentario</label>
          </div>
          {mostrarErrores && errores.comentario && (
            <span className="editsoc-error">{errores.comentario}</span>
          )}
        </div>

        <div className="editsoc-buttons">
          <button type="submit">
            <FontAwesomeIcon icon={faSave} className="editsoc-icon-button" />
            Actualizar Socio
          </button>
          <button type="button" onClick={() => navigate('/socios')}>
            <FontAwesomeIcon icon={faArrowLeft} className="editsoc-icon-button" />
            Cancelar
          </button>
        </div>
      </form>
    </div>
  );
};

export default EditarSocio;
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import BASE_URL from '../../config/config';
import './AgregarSocio.css';

const AgregarSocio = () => {
  const navigate = useNavigate();
  const [listas, setListas] = useState({ categorias: [], cobradores: [], estados: [] });
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
    dni: ''
  });
  const [errores, setErrores] = useState({});
  const [mostrarErrores, setMostrarErrores] = useState(false);

  useEffect(() => {
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
  }, []);

  const validarCampo = (name, value) => {
    const soloNumeros = /^[0-9]+$/;
    const textoValido = /^[A-ZÑa-zñáéíóúÁÉÍÓÚ0-9\s.,-]*$/;

    switch (name) {
      case 'dni':
      case 'numero':
      case 'telefono_movil':
      case 'telefono_fijo':
        if (value && !soloNumeros.test(value)) return '❌ Solo se permiten números';
        if (value.length > 20) return '❌ Máximo 20 caracteres';
        break;
      case 'nombre':
      case 'domicilio':
        if (value && !textoValido.test(value)) {
          return '❌ Solo se permiten letras, números, espacios, puntos, comas, guiones y Ñ';
        }
        if (value.length > 100) return '❌ Máximo 100 caracteres';
        break;
      case 'comentario':
      case 'domicilio_cobro':
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
    const valor = value.toUpperCase();
    setFormData((prev) => ({ ...prev, [name]: valor }));
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

    try {
      const response = await fetch(`${BASE_URL}/api.php?action=agregar_socio`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await response.json();
      if (data.exito) {
        alert('✅ Socio agregado correctamente');
        navigate('/socios');
      } else {
        if (data.errores) setErrores(data.errores);
        else alert('❌ Error: ' + data.mensaje);
      }
    } catch (error) {
      alert('❌ Error al conectar con el servidor');
    }
  };

  return (
    <div className="addsoc-container">
      <h2>Agregar Nuevo Socio</h2>
      <form className="addsoc-form" onSubmit={handleSubmit}>
        {[
          { name: 'nombre', label: 'Nombre completo *', type: 'text' },
          { name: 'domicilio', label: 'Domicilio', type: 'text' },
          { name: 'numero', label: 'Número', type: 'text' },
          { name: 'telefono_movil', label: 'Teléfono Móvil', type: 'text' },
          { name: 'telefono_fijo', label: 'Teléfono Fijo', type: 'text' },
          { name: 'comentario', label: 'Comentario', type: 'text' },
          { name: 'domicilio_cobro', label: 'Domicilio de Cobro', type: 'text' },
          { name: 'dni', label: 'DNI', type: 'text' },
        ].map(({ name, label, type }) => (
          <div className="addsoc-field" key={name}>
            <div className="addsoc-input-container">
              <input
                name={name}
                type={type}
                value={formData[name]}
                onChange={handleChange}
                className={formData[name] ? 'addsoc-input-filled' : ''}
              />
              <label className="addsoc-floating-label">{label}</label>
            </div>
            {mostrarErrores && errores[name] && (
              <span className="addsoc-error">{errores[name]}</span>
            )}
          </div>
        ))}

        <div className="addsoc-field">
          <div className="addsoc-input-container">
            <select 
              name="id_cobrador" 
              onChange={handleChange}
              value={formData.id_cobrador}
              className={formData.id_cobrador ? 'addsoc-input-filled' : ''}
            >
              <option value=""></option>
              {listas.cobradores.map(c => (
                <option key={c.id} value={c.id}>{c.nombre}</option>
              ))}
            </select>
            <label className="addsoc-floating-label">Seleccione Cobrador</label>
          </div>
        </div>

        <div className="addsoc-field">
          <div className="addsoc-input-container">
            <select 
              name="id_categoria" 
              onChange={handleChange}
              value={formData.id_categoria}
              className={formData.id_categoria ? 'addsoc-input-filled' : ''}
            >
              <option value=""></option>
              {listas.categorias.map(c => (
                <option key={c.id} value={c.id}>{c.descripcion}</option>
              ))}
            </select>
            <label className="addsoc-floating-label">Seleccione Categoría</label>
          </div>
        </div>

        <div className="addsoc-field">
          <div className="addsoc-input-container addsoc-date-container">
            <input 
              name="nacimiento" 
              type="date" 
              onChange={handleChange}
              value={formData.nacimiento}
              className="addsoc-input-filled"
            />
            <label className="addsoc-floating-label">Fecha de nacimiento</label>
          </div>
        </div>

        <div className="addsoc-field addsoc-last-field">
          <div className="addsoc-input-container">
            <select 
              name="id_estado" 
              onChange={handleChange}
              value={formData.id_estado}
              className={formData.id_estado ? 'addsoc-input-filled' : ''}
            >
              <option value=""></option>
              {listas.estados.map(e => (
                <option key={e.id} value={e.id}>{e.descripcion}</option>
              ))}
            </select>
            <label className="addsoc-floating-label">Seleccione Estado</label>
          </div>
        </div>

        <div className="addsoc-buttons">
          <button type="submit">Guardar</button>
          <button type="button" onClick={() => navigate('/socios')}>Cancelar</button>
        </div>
      </form>
    </div>
  );
};

export default AgregarSocio;
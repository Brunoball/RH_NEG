import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import BASE_URL from '../../config/config';
import './Socios.css';

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
    dni: '',
  });
  const [errores, setErrores] = useState({});

  useEffect(() => {
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
    fetchListas();
  }, []);

  const soloNumeros = (valor) => /^[0-9]*$/.test(valor);
  const permitirTexto = (valor) => /^[A-ZÑa-zñáéíóúÁÉÍÓÚ\s.,-]*$/.test(valor);

  const handleChange = (e) => {
    const { name, value } = e.target;
    let valor = value.toUpperCase(); // 🟩 convertir a mayúsculas

    if (['dni', 'telefono_movil', 'telefono_fijo', 'numero'].includes(name) && !soloNumeros(valor)) return;
    if (
      ['nombre', 'domicilio', 'comentario', 'domicilio_cobro'].includes(name) &&
      !permitirTexto(valor)
    ) return;

    setFormData((prev) => ({ ...prev, [name]: valor }));
    // Limpiar error cuando el usuario corrige
    if (errores[name]) {
      setErrores(prev => {
        const newErrores = { ...prev };
        delete newErrores[name];
        return newErrores;
      });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.nombre.trim()) {
      setErrores({ nombre: '⚠️ El nombre es obligatorio' });
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
        // Mostrar todos los errores que vienen del backend
        if (data.errores) {
          setErrores(data.errores);
        } else {
          alert('❌ Error: ' + data.mensaje);
        }
      }
    } catch (error) {
      console.error('Error:', error);
      alert('❌ Error al conectar con el servidor');
    }
  };

  return (
    <div className="formulario-container">
      <h2>Agregar Nuevo Socio</h2>
      <form className="formulario-socio" onSubmit={handleSubmit}>
        <div className="campo-formulario">
          <input name="nombre" placeholder="Nombre completo *" onChange={handleChange} required />
          {errores.nombre && <span className="error-message">{errores.nombre}</span>}
        </div>
        
        <div className="campo-formulario">
          <select name="id_cobrador" onChange={handleChange}>
            <option value="">Seleccione Cobrador</option>
            {listas.cobradores.map(c => (
              <option key={c.id} value={c.id}>{c.nombre}</option>
            ))}
          </select>
        </div>
        
        <div className="campo-formulario">
          <select name="id_categoria" onChange={handleChange}>
            <option value="">Seleccione Categoría</option>
            {listas.categorias.map(c => (
              <option key={c.id} value={c.id}>{c.descripcion}</option>
            ))}
          </select>
        </div>
        
        <div className="campo-formulario">
          <input name="domicilio" placeholder="Domicilio" onChange={handleChange} />
          {errores.domicilio && <span className="error-message">{errores.domicilio}</span>}
        </div>
        
        <div className="campo-formulario">
          <input name="numero" placeholder="Número" onChange={handleChange} />
          {errores.numero && <span className="error-message">{errores.numero}</span>}
        </div>
        
        <div className="campo-formulario">
          <input name="telefono_movil" placeholder="Teléfono Móvil" onChange={handleChange} />
          {errores.telefono_movil && <span className="error-message">{errores.telefono_movil}</span>}
        </div>
        
        <div className="campo-formulario">
          <input name="telefono_fijo" placeholder="Teléfono Fijo" onChange={handleChange} />
          {errores.telefono_fijo && <span className="error-message">{errores.telefono_fijo}</span>}
        </div>
        
        <div className="campo-formulario">
          <input name="comentario" placeholder="Comentario" onChange={handleChange} />
          {errores.comentario && <span className="error-message">{errores.comentario}</span>}
        </div>
        
        <div className="campo-formulario">
          <label className="label-fecha">
            Fecha de nacimiento
            <input name="nacimiento" type="date" onChange={handleChange} />
          </label>
        </div>
        
        <div className="campo-formulario">
          <select name="id_estado" onChange={handleChange}>
            <option value="">Seleccione Estado</option>
            {listas.estados.map(e => (
              <option key={e.id} value={e.id}>{e.descripcion}</option>
            ))}
          </select>
        </div>
        
        <div className="campo-formulario">
          <input name="domicilio_cobro" placeholder="Domicilio de Cobro" onChange={handleChange} />
          {errores.domicilio_cobro && <span className="error-message">{errores.domicilio_cobro}</span>}
        </div>
        
        <div className="campo-formulario">
          <input name="dni" placeholder="DNI" onChange={handleChange} />
          {errores.dni && <span className="error-message">{errores.dni}</span>}
        </div>
        
        <div className="botones-formulario">
          <button type="submit">Guardar</button>
          <button type="button" onClick={() => navigate('/socios')}>Cancelar</button>
        </div>
      </form>
    </div>
  );
};

export default AgregarSocio;
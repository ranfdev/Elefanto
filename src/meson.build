pkgdatadir = join_paths(get_option('datadir'), meson.project_name())
gnome = import('gnome')

src_res = gnome.compile_resources('com.github.ranfdev.elefanto.src',
  'com.github.ranfdev.elefanto.src.gresource.xml',
  gresource_bundle: true,
  install: true,
  install_dir: pkgdatadir,
)

data_res = gnome.compile_resources('com.github.ranfdev.elefanto.data',
  'com.github.ranfdev.elefanto.data.gresource.xml',
  gresource_bundle: true,
  install: true,
  install_dir: pkgdatadir,
)

bin_conf = configuration_data()
bin_conf.set('GJS', find_program('gjs').path())
bin_conf.set('PACKAGE_VERSION', meson.project_version())
bin_conf.set('PACKAGE_NAME', meson.project_name())
bin_conf.set('prefix', get_option('prefix'))
bin_conf.set('libdir', join_paths(get_option('prefix'), get_option('libdir')))
bin_conf.set('datadir', join_paths(get_option('prefix'), get_option('datadir')))

libhandy_dep = dependency('libhandy-1', version: '>= 0.9.90', required: false)
if not libhandy_dep.found()
  libhandy = subproject(
    'libhandy',
    install: false,
    default_options: [
      'examples=false',
      'package_subdir=elefanto',
      'tests=false',
      'builtype=release'
    ]
  )
  libhandy_dep = libhandy.get_variable('libhandy_dep')
endif

configure_file(
  input: 'com.github.ranfdev.elefanto.in',
  output: 'com.github.ranfdev.elefanto',
  configuration: bin_conf,
  install: true,
  install_dir: get_option('bindir')
)

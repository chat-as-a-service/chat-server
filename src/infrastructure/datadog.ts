import tracer from 'dd-trace';

tracer.init(); // initialized in a different file to avoid hoisting.
tracer.use('http', {
  blocklist: ['/health']
})
export default tracer;
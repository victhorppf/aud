function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    var images = data.images;
    var filesInfo = [];

    if (!images || !Array.isArray(images)) {
      throw new Error("Formato de dados inválido. 'images' deve ser um array.");
    }

    images.forEach(function(image, index) {
      var decodedImage = Utilities.base64Decode(image.base64);
      var blob = Utilities.newBlob(decodedImage, image.mimeType, image.fileName);

      // Você pode organizar as imagens em pastas se desejar
      // Ex: var folder = DriveApp.getFolderById("ID_DA_PASTA_RAIZ");
      // var file = folder.createFile(blob);
      var file = DriveApp.createFile(blob);

      // Torna o arquivo publicamente visível para que possa ser exibido no app
      file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

      filesInfo.push({
        id: file.getId(),
        name: file.getName(),
        key: image.fileName // Retorna a chave original para mapeamento no frontend
      });
    });

    return ContentService
      .createTextOutput(JSON.stringify({ status: 'success', files: filesInfo }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    Logger.log(err);
    return ContentService
      .createTextOutput(JSON.stringify({ status: 'error', message: err.message, stack: err.stack }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}